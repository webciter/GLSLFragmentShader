/* 
 * GLSLFragmentShader
 * 
 * This class creates the canvas element within the parent element but hidden by display: none;
 * This gives us the ability to create our own transition effects, which should be handled externally
 * 
 * @author David Clews
 * @version 1.0.0
 * @authorUrl http://davidclews.com
 * @repoUrl http://github.com/webciter/GLSLFragmentShader
 * @licence MIT
 * 
 */

/*

Copyright 2019 David Clews

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation 
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, 
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the 
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE 
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR 
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/*
 * GLSLFragmentShader
 * 
 * @param {HTMLElement} [parentElement] The element that the canvas is contained
 * @param {string|object} glslDefinition The JSON or URL to the JSON
 * @returns {undefined}
 */
window.GLSLFragmentShader = function(parentElement = document.body, glslDefinition){
    
    let self = this,
            GLSLFragmentShaderLoadedEvent = new Event('GLSLFragmentShaderLoaded'),
            
    gl, /* the webgl context */
    buffer,
    currentProgram,
    vertexPosition,
    screenVertexPosition,
    parameters = { startTime: Date.now(), time: 0, mouseX: 0.5, mouseY: 0.5, screenWidth: 0, screenHeight: 0 },
    surface = { centerX: 0, centerY: 0, width: 1, height: 1, isPanning: false, isZooming: false, lastX: 0, lastY: 0 },
    frontTarget,
    backTarget,
    screenProgram,
    getWebGL,
    resizer = {},
    glslJSON, /* holds the GLSL JSON as defined at http://www.davidclews.com/viewtopic.php?f=183&t=459 */
    canvasContainer,
    enableMouse = false;
    
    /* getters */
    self.width = 0;
    self.height = 0 ;
    self.size = 2; /* this is the output size relative to 100% */
    
    
    
    /*
     * loadGLSLFragmentShader
     * 
     * Loads the shader from JSON file stored on server
     * 
     * @param {string} url The absolute location to the json file containing the source code for the shader
     * @return {JSON} the json object
     */
    let loadGLSLShader = function(){
        
        return new Promise(function(resolve, reject){
            
            /* TODO do some simple validation checks */
            
            if(typeof glslDefinition === "object"){
	        glslJSON = glslDefinition;
                resolve();
            }else if(typeof glslDefinition === "string"){
                /* load through ajax */
                try{

                        let xhttp = new window.XMLHttpRequest();


                        /* called after send */
                        xhttp.onreadystatechange = function() {
                            try{
                                if (this.readyState === 4 && this.status === 200) {
                                    /* do the event for a successful post|get */
                                    glslJSON = JSON.parse(this.responseText);
                                    resolve();
                                }else if(this.readyState === 4){
                                    /* any other http code is a failure  */
                                    reject("Unable to download GLSL JSON file, from url "+glslDefinition)
                                }
                            }catch(err){
                                /* run the error function */
                                //alert("error");
                            }
                        };

                        /* check if we can send a get */

                        xhttp.open("GET", glslDefinition, true);

                        /* this needs to be set or we will not receive any data */
                        //xhttp.setRequestHeader('Cache-Control', 'public, max-age=86400');
                        xhttp.send();

                    }catch(err){            
                        throw err;
                    }

            }
        
        });
    }
    
    /*
     * init
     * 
     * @returns {undefined}
     */
    let init = function(){
        /* create the script tags if not exist */
        self.canvas = document.createElement( 'canvas' );
        self.canvas.style.display = "none";
        parentElement.appendChild(self.canvas);
        
        /* create the starter shaders */
        
        /* these shaders are assigned to the head for later use, but only once per page load */
        if(!document.getElementById("GLSLFragmentShader_fragmentShader")){
            let GLSLShaderScript = document.createElement("script");
            GLSLShaderScript.id = "GLSLFragmentShader_fragmentShader";
            GLSLShaderScript.setAttribute("type", "x-shader/x-fragment");
            GLSLShaderScript.textContent = 
            `
            #ifdef GL_ES
              precision mediump float;
            #endif

            uniform vec2 resolution;
            uniform sampler2D texture;

            void main() {

               vec2 uv = gl_FragCoord.xy / resolution.xy;
               gl_FragColor = texture2D( texture, uv );

            }
            `;
            document.getElementsByTagName("head")[0].appendChild(GLSLShaderScript)
        }
        
        if(!document.getElementById("GLSLFragmentShader_vertexShader")){
            let GLSLShaderScript = document.createElement("script");
                        GLSLShaderScript.id = "GLSLFragmentShader_vertexShader";

            GLSLShaderScript.setAttribute("type", "x-shader/x-vertex");
            GLSLShaderScript.textContent = 
            `
            attribute vec3 position;

            void main() {

                gl_Position = vec4( position, 1.0 );

            }
            `;
            document.getElementsByTagName("head")[0].appendChild(GLSLShaderScript)
        }
        
        if(!document.getElementById("GLSLFragmentShader_surfaceVertexShader")){
            let GLSLShaderScript = document.createElement("script");
                        GLSLShaderScript.id = "GLSLFragmentShader_surfaceVertexShader";

            GLSLShaderScript.setAttribute("type", "x-shader/x-vertex");
            GLSLShaderScript.textContent = 
            `
            attribute vec3 position;
            attribute vec2 surfacePosAttrib;
            varying vec2 surfacePosition;

            void main() {

                surfacePosition = surfacePosAttrib;
                gl_Position = vec4( position, 1.0 );

            }
            `;
            document.getElementsByTagName("head")[0].appendChild(GLSLShaderScript)
        }
        
        /* get WebGL context */

        try {
            gl = self.canvas.getContext( 'webgl', { preserveDrawingBuffer: true } ); /* use webgl 1 for more browser support */
            self.context =  gl;
            
        } catch( error ) { 
        
        }
        
        if ( !gl ) {
            console.log("WebGL not supported");
        } else {
            // enable dFdx, dFdy, fwidth
            // In WebGL2, the functionality of this extension is available on the WebGL2 context by default.
            gl.getExtension('OES_standard_derivatives');

            /* Create vertex buffer (2 triangles) */

            buffer = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ - 1.0, - 1.0, 1.0, - 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0, 1.0, - 1.0, 1.0 ] ), gl.STATIC_DRAW );

            /* Create surface buffer (coordinates at screen corners) */

            surface.buffer = gl.createBuffer();
        }

        let clientXLast, clientYLast;

        self.canvas.addEventListener( 'mousemove', function ( event ) {
            
            if(enableMouse){
                let styles = window.getComputedStyle(self.canvas);
                let replace = /[px]/g; 

                let canvasWidth = Math.ceil(styles.getPropertyValue("width").replace(replace,''));
                let canvasHeight = Math.ceil(styles.getPropertyValue("height").replace(replace,''));

                let coor = getMousePos(event.target, event);

                let clientX = event.clientX;
                let clientY = event.clientY;

                if (clientXLast == clientX && clientYLast == clientY){
                    return;
                }

                clientXLast = clientX;
                clientYLast = clientY;

                let dx, dy;

                parameters.mouseX = coor.x / canvasWidth;
                parameters.mouseY = 1 - coor.y / canvasHeight;

                if (resizer.isResizing) {

                  resizer.currentWidth = Math.max(Math.min(clientX - resizer.offsetMouseX, resizer.maxWidth), resizer.minWidth);
                  resizer.currentHeight = Math.max(Math.min(clientY - resizer.offsetMouseY, resizer.maxHeight), resizer.minWidth);
                  event.preventDefault();

                } else if (surface.isPanning) {

                  dx = clientX - surface.lastX;
                  dy = clientY - surface.lastY;
                  surface.centerX -= dx * surface.width / window.innerWidth;
                  surface.centerY += dy * surface.height / window.innerHeight;
                  surface.lastX = clientX;
                  surface.lastY = clientY;
                  computeSurfaceCorners();
                  event.preventDefault();

                } else if (surface.isZooming) {

                  dx = clientX - surface.lastX;
                  dy = clientY - surface.lastY;
                  surface.height *= Math.pow(0.997, dx + dy);
                  surface.lastX = clientX;
                  surface.lastY = clientY;
                  computeSurfaceCorners();
                  event.preventDefault();

                }
            }
        }, false );
       

        /*
         * settleDown 
         */
        function settleDown ( event ) {
            resizer.isResizing = surface.isPanning = surface.isZooming = false;
        }

        /* 
         * mouseLeave
         */
        function mouseLeave(event) {
            if(enableMouse){
                settleDown(event);
            }
        }
        
        /*
         * getMousePos
         * 
         * @return {object} The x and y coordinates within the element
         */
        function getMousePos(canvas, evt) {
            let rect = canvas.getBoundingClientRect();
            return {
              x: evt.clientX - rect.left,
              y: evt.clientY - rect.top
            };
        }

       document.addEventListener( 'mouseup', settleDown, false );
       document.addEventListener( 'mouseleave', mouseLeave, false );

       onWindowResize();
       window.addEventListener( 'resize', onWindowResize, false );

       /* */
       resetSurface();
       compile();


       compileScreenProgram();

	if (gl) {
            /* dispath event the the canvas is ready for output */
            animate();
            parentElement.dispatchEvent(GLSLFragmentShaderLoadedEvent);

	 }
    }
    
    /* 
     * computeSurfaceCorners
     * 
     * @return {undefined} 
     */
    let computeSurfaceCorners = function () {

    if (gl) {

        surface.width = surface.height * parameters.screenWidth / parameters.screenHeight;
					
        let halfWidth = surface.width * 0.5, halfHeight = surface.height * 0.5;
					
        gl.bindBuffer( gl.ARRAY_BUFFER, surface.buffer );
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
            surface.centerX - halfWidth, surface.centerY - halfHeight,
            surface.centerX + halfWidth, surface.centerY - halfHeight,
            surface.centerX - halfWidth, surface.centerY + halfHeight,
            surface.centerX + halfWidth, surface.centerY - halfHeight,
            surface.centerX + halfWidth, surface.centerY + halfHeight,
            surface.centerX - halfWidth, surface.centerY + halfHeight ] ), gl.STATIC_DRAW);
        }
    }
 
 
 
    /* 
     * resetSurface 
     * 
     * @return {undefined}
     */
    function resetSurface() {
        surface.centerX = surface.centerY = 0;
        surface.height = 1;
        computeSurfaceCorners();
    }
 
 
 
    /*
     * compile
     * 
     * @return {undefined}
     */
    function compile() {
			
        if (!gl) {
				
            if (!getWebGL) {
					
                getWebGL = true;
            }

            return;
        }


        let program = gl.createProgram();

        let fragment = glslJSON.glsl_fragment_code;
        let vertex = document.getElementById( 'GLSLFragmentShader_surfaceVertexShader' ).textContent;

        let vs = createShader( vertex, gl.VERTEX_SHADER );
        let fs = createShader( fragment, gl.FRAGMENT_SHADER );

        if ( vs == null || fs == null ) return null;

        gl.attachShader( program, vs );
        gl.attachShader( program, fs );
        gl.deleteShader( vs );
        gl.deleteShader( fs );
        gl.linkProgram( program );

        if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
            let error = gl.getProgramInfoLog( program );
            console.error( 'VALIDATE_STATUS: ' + gl.getProgramParameter( program, gl.VALIDATE_STATUS ), 'ERROR: ' + gl.getError() );
            return;
        }

        if ( currentProgram ) {
            gl.deleteProgram( currentProgram );
            setURL( fragment );
        }

        currentProgram = program;

        /* Cache uniforms */

        cacheUniformLocation( program, 'time' );
        cacheUniformLocation( program, 'mouse' );
        cacheUniformLocation( program, 'resolution' );
        cacheUniformLocation( program, 'backbuffer' );
        cacheUniformLocation( program, 'surfaceSize' );

        /* Load program into GPU */

        gl.useProgram( currentProgram );

        /* Set up buffers */

        /* caused an error */
        //surface.positionAttribute = gl.getAttribLocation(currentProgram, "surfacePosAttrib");
        //gl.enableVertexAttribArray(surface.positionAttribute);

        vertexPosition = gl.getAttribLocation(currentProgram, "position");
        gl.enableVertexAttribArray( vertexPosition );
  

 }

    /*
     * compileScreenProgram
     * 
     * @return {undefined}
     */
    function compileScreenProgram() {
			
        if (!gl) {
            return;
        }

        let program = gl.createProgram();
        let fragment = document.getElementById( 'GLSLFragmentShader_fragmentShader' ).textContent;
        let vertex = document.getElementById( 'GLSLFragmentShader_vertexShader' ).textContent;

        let vs = createShader( vertex, gl.VERTEX_SHADER );
        let fs = createShader( fragment, gl.FRAGMENT_SHADER );

        gl.attachShader( program, vs );
        gl.attachShader( program, fs );

        gl.deleteShader( vs );
        gl.deleteShader( fs );

        gl.linkProgram( program );

        if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {

        console.error( 'VALIDATE_STATUS: ' + gl.getProgramParameter( program, gl.VALIDATE_STATUS ), 'ERROR: ' + gl.getError() );

        return;

    }

        screenProgram = program;

        gl.useProgram( screenProgram );

        cacheUniformLocation( program, 'resolution' );
        cacheUniformLocation( program, 'texture' );

        screenVertexPosition = gl.getAttribLocation(screenProgram, "position");
        gl.enableVertexAttribArray( screenVertexPosition );

    }
    
    /* 
    * cacheUniformLocation
    *
    * @param {WebGLProgram} program
    * @param {string} label
    * @return {undefined}
    */
    function cacheUniformLocation( program, label ) {
        if ( program.uniformsCache === undefined ) {
            program.uniformsCache = {};
        }
        
        program.uniformsCache[ label ] = gl.getUniformLocation( program, label );
    }

    /*
    * createTarget
    * 
    * @param {integer} width
    * @param {integer} height
    * @return {obeject} An object contaning all the required 
    */
    function createTarget( width, height ) {

        let target = {};
 
        target.framebuffer = gl.createFramebuffer();
        target.renderbuffer = gl.createRenderbuffer();
        target.texture = gl.createTexture();

        /* set up framebuffer */

        gl.bindTexture( gl.TEXTURE_2D, target.texture );
        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );

        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );

        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );

        gl.bindFramebuffer( gl.FRAMEBUFFER, target.framebuffer );
        gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0 );

        /* set up renderbuffer */

        gl.bindRenderbuffer( gl.RENDERBUFFER, target.renderbuffer );

        gl.renderbufferStorage( gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height );
        gl.framebufferRenderbuffer( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, target.renderbuffer );

        /* clean up */

        gl.bindTexture( gl.TEXTURE_2D, null );
        gl.bindRenderbuffer( gl.RENDERBUFFER, null );
        gl.bindFramebuffer( gl.FRAMEBUFFER, null);

        return target;

    }

    /* 
    * createRenderTargets
    * @return {undefined}
    */
    function createRenderTargets() {

        frontTarget = createTarget( parameters.screenWidth, parameters.screenHeight );
        backTarget = createTarget( parameters.screenWidth, parameters.screenHeight );

    }

    /*
    * htmlEncode
    * @param {string} str
    * @param {string}
    * @return {undefined}
    */		
    function htmlEncode(str){

        return String(str)
         .replace(/&/g, '&amp;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#39;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');

    }

    /*
    * createShader
    *
    * @param {DOMString} src
    * @param {VERTEX_SHADER|FRAGMENT_SHADER} type 
    * @return {WebGLShader} A configured WebGLShader 
    */
    function createShader( src, type ) {
			
        let shader = gl.createShader( type );

        gl.shaderSource( shader, src );
        gl.compileShader( shader );

        if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {

            let error = gl.getShaderInfoLog( shader );

            /* Remove trailing linefeed, for FireFox's benefit. */
            while ((error.length > 1) && (error.charCodeAt(error.length - 1) < 32)) {
                error = error.substring(0, error.length - 1);
            }

            console.error( error );

            return null;

        }

        return shader;

    }

    /*
    * onWindowResize
    *
    * Resizes the canvas based on a resize event
    *
    * @param {Event} event
    * @return {undefined}
    */
    function onWindowResize( event ) {
        let styles = window.getComputedStyle(parentElement);
        let replace = /[px]/g; 

        let eleWidth = (styles.getPropertyValue("width").replace(replace,'')-styles.getPropertyValue("border-left-width").replace(replace,'')-styles.getPropertyValue("border-right-width").replace(replace,''));
        let eleHeight = (styles.getPropertyValue("height").replace(replace,'')-styles.getPropertyValue("border-top-width").replace(replace,'')-styles.getPropertyValue("border-bottom-width").replace(replace,''));


        //let eleWidth = styles.getPropertyValue("width").replace(replace,'');
        //let eleHeight = styles.getPropertyValue("height").replace(replace,'');

        /* rendering dimentions */
        self.canvas.width = Math.ceil(eleWidth / self.size);
        self.canvas.height = Math.ceil(eleHeight / self.size);

        //self.canvas.style.width = Math.ceil(eleWidth / self.size) + 'px';
        //self.canvas.style.height = Math.ceil(eleHeight / self.size) + 'px';

        /* expose externally */
        self.width = Math.ceil(eleWidth / self.size);
        self.height = Math.ceil(eleHeight / self.size);

        parameters.screenWidth = self.canvas.width;
        parameters.screenHeight = self.canvas.height;

        computeSurfaceCorners();

        if (gl) {

            gl.viewport( 0, 0, self.canvas.width, self.canvas.height );
            createRenderTargets();

        }
    }

    /* refresh */
    self.refresh = function(){
        onWindowResize();
    }
 
    /* 
     * animate
     * @return {undefined}
     */
    function animate() {

        requestAnimationFrame( animate );
        render();

    }

    /* 
     * render
     *
     * @return {undefined}
     */
    function render() {
  
        /* no rendering occurs if currentProgram is not set */
        if ( !currentProgram ) {
            return
        };

        parameters.time = Date.now() - parameters.startTime;

        /* Set uniforms for custom shader */

        gl.useProgram( currentProgram );

        /* set the uniform variables for the shader */
        gl.uniform1f( currentProgram.uniformsCache[ 'time' ], parameters.time / 1000 );
        gl.uniform2f( currentProgram.uniformsCache[ 'mouse' ], parameters.mouseX, parameters.mouseY );
        gl.uniform2f( currentProgram.uniformsCache[ 'resolution' ], parameters.screenWidth, parameters.screenHeight );
        gl.uniform1i( currentProgram.uniformsCache[ 'backbuffer' ], 0 );
        gl.uniform2f( currentProgram.uniformsCache[ 'surfaceSize' ], surface.width, surface.height );

        gl.bindBuffer( gl.ARRAY_BUFFER, surface.buffer );
        gl.vertexAttribPointer( surface.positionAttribute, 2, gl.FLOAT, false, 0, 0 );

        gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
        gl.vertexAttribPointer( vertexPosition, 2, gl.FLOAT, false, 0, 0 );

        gl.activeTexture( gl.TEXTURE0 );
        gl.bindTexture( gl.TEXTURE_2D, backTarget.texture );

        /* Render custom shader to front buffer */

        gl.bindFramebuffer( gl.FRAMEBUFFER, frontTarget.framebuffer );

        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.drawArrays( gl.TRIANGLES, 0, 6 );

        /* Set uniforms for screen shader */

        gl.useProgram( screenProgram );

        gl.uniform2f( screenProgram.uniformsCache[ 'resolution' ], parameters.screenWidth, parameters.screenHeight );
        gl.uniform1i( screenProgram.uniformsCache[ 'texture' ], 1 );

        gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
        gl.vertexAttribPointer( screenVertexPosition, 2, gl.FLOAT, false, 0, 0 );

        gl.activeTexture( gl.TEXTURE1 );
        gl.bindTexture( gl.TEXTURE_2D, frontTarget.texture );

        /* Render front buffer to screen */

        gl.bindFramebuffer( gl.FRAMEBUFFER, null );

        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.drawArrays( gl.TRIANGLES, 0, 6 );

        /* Swap buffers */

        let tmp = frontTarget;
        frontTarget = backTarget;
        backTarget = tmp;

    }
    
    /* load the json glsl definition then create it */
    loadGLSLShader().then(function(jsonData){
     
	/* config class */
	if(typeof glslJSON.enableMouse !== "undefined"){
		enableMouse = glslJSON.enableMouse;
	}

        init();
        
    });
}


