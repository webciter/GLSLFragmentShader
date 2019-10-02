# GLSLFragmentShader
Implement a GLSL Fragment Shader into JavaScript

<h3>Example</h3>

<img src="http://davidclews.com/applications/programming/glsl/games_console_dashboard_background/screenshot.png" />

Check out this webgl shader at

http://davidclews.com/applications/programming/glsl/games_console_dashboard_background/index.html

<h3>Construct</h3>

The construct accepts two parameters, the first is the element is where the WebGL canvas will be added, and the second parameter is a string URL or a JSON object that contains the definition of the GLSL Fragment Shader. take a look at the example source code.

<pre>

let glslJSON = {
		     "name": "Games Console Dashboard Background",
		     "version": "1.0.0",
		     "keywords": [
			  "games",
			  "console",
			  "slow",
			  "stars",
			  "blue"
		     ],
		     "description": "A games console dashboard background simulation, this is ideal for a website background.",
		     "author": {
			  "name": "",
			  "email": "",
			  "url": ""
		     },
		     "licence": {
			  "type": "",
			  "url": ""
		     },
		     "previewUrl": "http://glslsandbox.com/e#53674.1",
		     "repositoryUrl": "http://glslsandbox.com/e#53674.1",
		     "enableMouse": true,
		     "glsl_fragment_code": "/*\n * Fish removed from original shader.\n * Original shader from: https://www.shadertoy.com/view/ltdyDl\n * mixed with other shader from: // From ShaderToy https://www.shadertoy.com/view/Xtt3R4\n */\n\n#ifdef GL_ES\nprecision mediump float;\n#endif\n\n// glslsandbox uniforms\nuniform float time;\nuniform vec2 resolution;\n\n// shadertoy globals\nfloat iTime = 0.0;\nvec3  iResolution = vec3(0.0);\nconst vec4  iMouse = vec4(0.0);\n\n// Protect glslsandbox uniform names\n#define time        stemu_time\n\n// --------[ Original ShaderToy begins here ]---------- //\n\n// GLOBALS\n\n// position & direction\nvec3 pos_finn = vec3(0.), pos_eyes = vec3(0.);\nvec3 dir_eye = vec3(0.);\nmat3 dir_mouth = mat3(0.);\nvec3 dir_light = vec3(0.);\n\n// coloring and animation\nfloat heye = 0., weye = 0., beye = 0.;\nfloat hmouth = 0., cmouth = 0.;\nfloat hfinns = 0., htail = 0.;\nfloat puff = 0.;\nfloat time = 0.;\nfloat tim_tail = 0.;\nfloat ani_tail = 0., ani_mouth = 0.;\n\n// colors\nconst vec3 col_water = vec3(.3, .7, 1.);\nconst vec3 col_fish_1 = vec3(1., 0.4, 0.2);\nconst vec3 col_fish_2 = vec3(1., 0.8, 0.5);\nconst vec3 col_eyes = vec3(0.7, 0.75, 1.);\n\n// marching\nconst float maxdist = 5.;\nconst float det = .001;\n\n\n\n// USEFUL LITTLE FUNCTIONS\n\n// 2D rotation\nmat2 rot2D(float a) {\n  a = radians(a);\n  float s = sin(a);\n  float c = cos(a);\n  return mat2(c, s, -s, c);\n}\n\n// Align vector\nmat3 lookat(vec3 fw, vec3 up) {\n  fw = normalize(fw);\n  vec3 rt = normalize(cross(fw, normalize(up)));\n  return mat3(rt, cross(rt, fw), fw);\n}\n\n\n// Tile fold \nfloat fmod(float p, float c) { return abs(c - mod(p, c * 2.)) / c; }\n\n// Smooth min\nfloat smin(float a, float b, float k) {\n  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n  return mix(b, a, h) - k * h * (1.0 - h);\n}\n\n// Smooth max\nfloat smax(float a, float b, float k) {\n  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);\n  return mix(b, a, h) - k * h * (1.0 - h);\n}\n\n// Torus\nfloat sdTorus(vec3 p, vec2 t, vec3 s) {\n  p = p.yxz * s;\n  vec2 q = vec2(length(p.xz) - t.x, p.y);\n  return length(q) - t.y;\n}\n\n\n\n\n// BACKGROUND AND FOREGROUND FRACTAL\n\nfloat fractal(vec3 p) {\n  p += cos(p.z * 3. + time * 4.) * .02;\n  float depth = smoothstep(0., 6., -p.z + 5.);\n  p *= .3;\n  p = abs(2. - mod(p + vec3(0.4, 0.7, time * .07), 4.));\n  float ls = 0.;\n  float c = 0.;\n  for (int i = 0; i < 6; i++) {\n    p = abs(p) / min(dot(p, p), 1.) - .9;\n    float l = length(p);\n    c += abs(l - ls);\n    ls = l;\n  }\n  return .15 + smoothstep(0., 50., c) * depth * 4.;\n}\n\n// NORMALS AND LIGHTING\n\n\n\n\n\nfloat light(vec3 p, vec3 dir, vec3 n, float shw) {\n  float dif = pow(max(0., dot(dir_light, -n)), 3.);\n  float amb = pow(max(0., dot(dir, -n)), 3.);\n  return dif * .7 * shw + amb * .2 + .15;\n}\n\n// RAY MARCHING AND SHADING\n\nvec3 march(vec3 from, vec3 dir) {\n  vec3 odir = dir;\n  vec3 p = from + dir * 2.;\n  float fg = fractal(p + dir) * .55;\n  vec3 col = vec3(0.);\n  float totdist = 0.;\n  float d;\n  float v = 0.;\n  cmouth = 1.;\n\n  float fade = smoothstep(maxdist * .2, maxdist * .9, maxdist - totdist);\n  float ref = 1.;\n\n  col *= normalize(col_water + 1.5) * 1.7;\n  p = maxdist * dir;\n  vec3 bk = fractal(p) * ref * col_water;\n  float glow = pow(max(0., dot(dir, -dir_light)), 1.5+0.0*1.5);\n  vec3 glow_water = normalize(col_water+1.);\n  bk += glow_water*(glow*(1.-0.0*.7) + pow(glow, 8.) * 1.5) * 1.0;\n  col += v * .06 * glow * ref * glow_water;\n  col += bk + fg * col_water;\n  return col;\n}\n\n// MAIN\nuniform vec2 mouse;\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\n    \n  // Set globals\n  time = mod(iTime, 600.);\n  ani_mouth = -(mouse.y-.5)*16.;\n  puff = -.03+.5*smoothstep(.945, .95, abs(sin(time * .1)))+ani_mouth*.04;\n  pos_finn = normalize(vec3(0.35, -1, 0.));\n  pos_eyes = vec3(-1., -1.1, 1.) * .12;\n  //pos_eyes*=1.+vec3(-1.,1.,0.)*puff*.05;\n  dir_light = normalize(vec3(-.3, 0.2, 1.));\n  dir_mouth = lookat(normalize(vec3(-.4-puff*.1+ani_mouth*.03, 0., -1.)), vec3(0., 1., 0.));\n  tim_tail = time * 2.;\n  ani_tail = cos(tim_tail);\n\n  // Pixel coordinates\n  vec2 uv = fragCoord / iResolution.xy - .5;\n  vec2 uv2 = uv;\n  float ar = iResolution.x / iResolution.y; \n  uv.x *= ar;\n\n  // Camera\n  vec2 mouse = (iMouse.xy / iResolution.xy - .5) * 4.;\n  float tcam = (time+67.)*.05;\n  float zcam = smoothstep(.7, 1., cos(tcam)) * 1.8 - .3;\n  zcam -= smoothstep(.7, 1., -cos(tcam)) * 1.6;\n  if (iMouse.z < .1) mouse = vec2(sin(time * .15)*ar, zcam);\n  vec3 dir = normalize(vec3(uv, .9));\n  vec3 from = vec3(1., 0., -0.5 + mouse.y) * 1.25;\n  from.xy *= rot2D(-mouse.x * 40.);\n  dir = lookat(normalize(-from+vec3(sin(time*.5)*.3,cos(time*.25)*.1,0.)), vec3(0., 0., -1.)) * dir;\n\n\n\n  // March and color\n  vec3 col = march(from, dir);\n  col *= vec3(1.1, .9, .8);\n  col += dot(uv2, uv2) * vec3(0., 0.6, 1.) * .8;\n\n  // Output to screen\n  fragColor = vec4(col, 1.);\n}\n\nconst vec3 top = vec3(0.318, 0.831, 1.0);\nconst vec3 bottom = vec3(0.094, 0.141, 0.424);\nconst float widthFactor = 1.5;\n\nvec3 calcSine(vec2 uv, float speed, \n              float frequency, float amplitude, float shift, float offset,\n              vec3 color, float width, float exponent, bool dir)\n{\n    float angle = iTime * speed * frequency * -1.0 + (shift + uv.x) * 2.0;\n    \n    float y = sin(angle) * amplitude + offset;\n    float clampY = clamp(0.0, y, y);\n    float diffY = y - uv.y;\n    \n    float dsqr = distance(y, uv.y);\n    float scale = 1.0;\n    \n    if(dir && diffY > 0.0)\n    {\n        dsqr = dsqr * 4.0;\n    }\n    else if(!dir && diffY < 0.0)\n    {\n        dsqr = dsqr * 4.0;\n    }\n    \n    scale = pow(smoothstep(width * widthFactor, 0.0, dsqr), exponent);\n    \n    return min(color * scale, color);\n}\n\nvoid mainImage2( out vec4 fragColor, in vec2 fragCoord )\n{\n\tmainImage(gl_FragColor, gl_FragCoord.xy);\n    vec2 uv = fragCoord.xy / iResolution.xy;\n    vec3 color = gl_FragColor.xyz;// vec3(mix(bottom, top, uv.y));\n\n    color += calcSine(uv, 0.2, 0.20, 0.2, 0.0, 0.5,  vec3(0.3, 0.3, 0.3), 0.1, 15.0,false);\n    color += calcSine(uv, 0.4, 0.40, 0.15, 0.0, 0.5, vec3(0.3, 0.3, 0.3), 0.1, 17.0,false);\n    color += calcSine(uv, 0.3, 0.60, 0.15, 0.0, 0.5, vec3(0.3, 0.3, 0.3), 0.05, 23.0,false);\n\n    color += calcSine(uv, 0.1, 0.26, 0.07, 0.0, 0.3, vec3(0.3, 0.3, 0.3), 0.1, 17.0,true);\n    color += calcSine(uv, 0.3, 0.36, 0.07, 0.0, 0.3, vec3(0.3, 0.3, 0.3), 0.1, 17.0,true);\n    color += calcSine(uv, 0.5, 0.46, 0.07, 0.0, 0.3, vec3(0.3, 0.3, 0.3), 0.05, 23.0,true);\n    color += calcSine(uv, 0.2, 0.58, 0.05, 0.0, 0.3, vec3(0.3, 0.3, 0.3), 0.2, 15.0,true);\n\n    fragColor = vec4(color,1.0);\n}\n\n\n// --------[ Original ShaderToy ends here ]---------- //\n\n#undef time\n\nvoid main(void)\n{\n    iTime = time;\n    iResolution = vec3(resolution, 0.0);\nmainImage2(gl_FragColor, gl_FragCoord.xy);\n    \n}"
		};

		let GLSLFrag = new GLSLFragmentShader(document.body, glslJSON);

</pre>

If your having issues implementing this take a look at the source code on my website.

<h3>Events</h3>

<h4>GLSLFragmentShaderLoaded</h4>

Once the GLSL Fragment Shader has been loaded the GLSLFragmentShaderLoaded will be triggered on the parent element.

<pre>
    document.body.addEventListener("GLSLFragmentShaderLoaded", function(event){
    	// setup your canvas, then refresh if required 
	glslCanvas.style.display = "block"; /* show the hidden canvas or run a transition effect here */
    });
</pre>

<h3>GLSL JSON Object Definition</h3>

Full rules of the JSON Definition can be found at, http://www.davidclews.com/viewtopic.php?f=183&t=459

<h3>Settings</h3>

<h4>GLSLFragmentShader.size</h4>

The size internally to GLSLFragmentShader Class effects the render size, the larger the size the more GPU power will be required. Use CSS css styles to stretch this. By using css styles on the canvas the GPU will not take any more Power

<h4>GLSLFragmentShader.enableMouse</h4>

Within the JSON definition to mouse interaction can be enabled and disabled manually but if set it in the json definition it will default to that.

<h3>Where to get these Fragment Shaders</h3>

You can use all the fragment shaders from glslsandbox.com, by creating your own compatible JSON files, simply copy and paste then encode. Iv created a tool for this using tampermonkey it can be found at http://www.davidclews.com/viewtopic.php?f=23&p=964#p964 remember to support there project.

A Fourm dedicated to the Fragment Shaders extracted by me http://www.davidclews.com/viewforum.php?f=180, each topic lets you download the shader json file.

