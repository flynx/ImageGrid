/**********************************************************************
* 
* Web Component defining an image waveform/histogram view widget.
*
*
* Example:
*	<script>
*		require('lib/object')
*		require('ig-image-graph')
*		...
*	</script>
*	...
*	<ig-image-graph 
*		graph="histogram"
*		src="../images/splash-800x500.jpg"
*		mode="color"
*		color="normalized" 
*		style="width: 600px; height: 300px"></ig-image-graph>
* 
*
* XXX add docs and examples -- canvas-waveform.html is outdated...
* XXX might be a good idea to add interactive feedback -- show on image 
* 		the denseties under the ursor for histogram or the slice/density 
* 		for the waveform...
* XXX add worker support...
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')



//---------------------------------------------------------------------
// image manipulation basics...

var Filters = 
module.Filters = {
	makeCanvas: function(w, h, canvas){
		var c = canvas 
			|| document.createElement('canvas')
		c.width = w
		c.height = h
		return c },

	// as input takes an HTML Image object...
	getPixels: function(img, tmp_canvas, w, h){
		var w = w 
			|| img.naturalWidth
		var h = h 
			|| img.naturalHeight
		var c = this.makeCanvas(w, h, tmp_canvas)
		var context = c.getContext('2d')
		if(img == null){
			context.rect(0, 0, w, h)
			context.fillStyle = "black"
			context.fill()
		} else {
			context.drawImage(img, 0, 0, w, h) }
		return context.getImageData(0, 0, c.width, c.height) },
	setPixels: function(c, data, w, h){
		w = c.width = w 
			|| data.width
		h = c.height = h 
			|| data.height
		var context = c.getContext('2d')
		context.putImageData(data, 0, 0) },

	// get image pixels normalized to a square of size s, rotated and flipped...
	//
	// NOTE: flip is applied to the image before it is rotated... (XXX ???)
	// XXX BUG: this is still wrong for images with exif orientation...
	// 		to reproduce:
	// 			loadImages: "L:/tmp/test/export-test/index-with-exif-rotation"
	// 			focusImage: 2
	// 			showMetadata
	getNormalizedPixels: function(img, tmp_canvas, s, rotate, flip){
		s = s 
			|| Math.max(img.naturalWidth, img.naturalHeight)
		rotate = rotate 
			|| 0

		;(rotate == 90 
				|| rotate == 270)
			&& (flip = flip == 'horizontal' ?
					'vertical'
				: flip == 'vertical' ?
					'horizontal'
				: flip)
		var [h, v] = flip == 'both' ?
				[-1, -1]
			: flip == 'horizontal' ?
				[-1, 1]
			: flip == 'vertical' ?
				[1, -1]
			: [1, 1]

		var c = this.makeCanvas(s, s, tmp_canvas)
		var context = c.getContext('2d')
		context.rect(0, 0, s, s)
		context.fillStyle = 'black'
		context.fill()

		if(img){
			context.setTransform(h*1, 0, 0, v*1, s/2, s/2)
			context.rotate(rotate * Math.PI/180)
			context.drawImage(img, -s/2, -s/2, s, s) }

		return context.getImageData(0, 0, s, s) }, 

	filterImage: function(filter, image, var_args){
		var args = [this.getPixels(image)]
		for(var i=2; i<arguments.length; i++){
			args.push(arguments[i]) }
		return filter.apply(null, args) },

	grayscale: function(pixels, args){
		var d = pixels.data
		for(var i=0; i<d.length; i+=4){
			var r = d[i]
			var g = d[i+1]
			var b = d[i+2]
			// CIE luminance for the RGB
			// The human eye is bad at seeing red and blue, so we de-emphasize them.
			var v = 0.2126*r 
				+ 0.7152*g 
				+ 0.0722*b
			d[i] = d[i+1] = d[i+2] = v }
		return pixels },
	// XXX need to resize this...
	histogram: function(pixels, mode, color){
		color = color 
			|| 'fill'
		mode = mode 
			|| 'luminance'

		var size = 255
		var w = size 
		var h = size

		// output buffer...
		var out = this.getPixels(null, null, w, h)

		// pixel hit buffer...
		var count = []

		var od = out.data
		var d = pixels.data

		// get the stats...
		for(var i=0; i<d.length; i+=4){
			var r = d[i]
			var g = d[i+1]
			var b = d[i+2]

			if(mode == 'luminance'){
				var v = Math.round(0.2126*r + 0.7152*g + 0.0722*b) * 4
				count[v] = count[v+1] = count[v+2] = (count[v] || 0) + 1

			} else {
				if(mode == 'color' 
						|| mode == 'R'){
					count[r*4] = (count[r*4] || 0) + 1 }
				if(mode == 'color' 
						|| mode == 'G'){
					count[g*4+1] = (count[g*4+1] || 0) + 1 }
				if(mode == 'color' 
						|| mode == 'B'){
					count[b*4+2] = (count[b*4+2] || 0) + 1 } } }

		var m = size / Math.max(...count.filter(function(){ return true }))

		var pos = function(i, value){
			return (
				// horizontal position...
				i*4 
				// value vertical offset...
				+ (size-Math.round(value*m))*w*4) }

		// XXX would be nice to have an option to draw full columns...
		count.forEach(function(v, i){
			var j = pos(i/4, v)
			while(j < od.length){
				j += w*4
				od[j] = 255
				if(color == 'point'){
					// correct for blue visibility...
					mode != 'luminance' 
						&& (i-2)%4 == 0
						&& (od[j-1] = od[j-2] = 180) 
					break } } })

		return out },
	waveform: function(pixels, mode, color){
		mode = mode 
			|| 'luminance'
		color = color 
			|| 'normalized'

		var w = pixels.width
		var h = pixels.height

		// normalize pixel ratio...
		var m = (1/h)*255

		var offsetTop = 0
		var offsetBottom = 0

		// output buffer...
		var out = this.getPixels(null, null,
			w, 
			offsetTop + 255 + offsetBottom)

		// pixel hit buffer...
		// XXX revise size -- do we need the alpha component??
		var count = new Int8Array(new ArrayBuffer(w * h * 4))
		//var count = []

		var od = out.data
		var d = pixels.data

		// calculate dot position...
		//
		// horizontal position offset...
		var _hp = w*4
		// top margin...
		var _tm = offsetTop*_hp
		var pos = function(i, value){
			return (_tm
				// horizontal position...
				+ i%(_hp)
				// value vertical offset...
				+ (255-Math.round(value))*_hp) }

		var gain = 100 * m

		// CIE luminance for RGB
		var Rl = 0.2126
		var Gl = 0.7152
		var Bl = 0.0722

		for(var i=0; i<d.length; i+=4){
			var r = d[i]
			var g = d[i+1]
			var b = d[i+2]
			var c, j, f, x, y

			if(mode === 'luminance'){
				var v = Rl*r + Gl*g + Bl*b
				c = count[j = pos(i, v)] = (count[j] || 0) + 1
				od[j] = od[j+1] = od[j+2] = c * gain

			} else {
				if(mode === 'color' || mode === 'R'){
					f = Rl
					x = 1
					y = 2
					j = pos(i, r)
					c = count[j] = (count[j] || 0) + 1
					od[j] = c * gain }
				if(mode === 'color' || mode === 'G'){
					f = Gl
					x = -1
					y = 1
					j = pos(i, g) + 1
					c = count[j] = (count[j] || 0) + 1
					od[j] = c * gain }
				if(mode === 'color' || mode === 'B'){
					f = Bl
					x = -2
					y = -1
					j = pos(i, b) + 2
					c = count[j] = (count[j] || 0) + 1
					od[j] = c * gain }

				// normalize...
				mode !== 'color'
					&& (color === 'white' ?
							(od[j+x] = od[j+y] = c * gain)
						: color === 'normalized' ?
							(od[j+x] = od[j+y] = c * gain/2 * (1-f))
						: null) } }
		return out },
}



//---------------------------------------------------------------------
// helpers...

var WAVEFORM_SIZE =
module.WAVEFORM_SIZE = 1000

var waveform = 
module.waveform = 
function(img, canvas, tmp_canvas, mode, color, rotate, flip){
	var d = Filters.getNormalizedPixels(img, tmp_canvas, WAVEFORM_SIZE, rotate, flip)
	var w = Filters.waveform(d, mode, color)
	Filters.setPixels(canvas, w) }


var HISTOGRAM_SIZE =
module.HISTOGRAM_SIZE = 1000

var histogram = 
module.histogram = 
function(img, canvas, tmp_canvas, mode, color){
	var d = Filters.getPixels(img, tmp_canvas)
	var w = Filters.histogram(d, mode, color)
	Filters.setPixels(canvas, w) }



//---------------------------------------------------------------------
// Custom element...

var igImageGraph_template = `
<style>
	:host {
		position: relative;
		display: inline-block;

		background: black;

		width: attr(image-width);
		height: attr(graph-height);

		padding-top: 16px;
		padding-bottom: 10px;
	}
	:host canvas {
		box-sizing: border-box;
		width: 100%;
		height: 100%;

		border-top: 1px dashed rgba(255, 255, 255, 0.2);
		border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
	}
	:host .controls {
		display: inline-block;
		position: absolute;
		top: 2px;
		right: 2px;
		left: 2px;
	}
	:host .controls button {
		background: transparent;
		border: none;
		color: white;
		opacity: 0.7;
		float: right;
		font-size: 12px;
	}
	:host .controls button[disabled] {
		opacity: 0.3;
		user-select: none;
	}
	:host .controls button.current {
		text-decoration: underline;
		opacity: 0.9;
	}
	:host .controls button:hover:not([disabled]) {
		opacity: 1;
	}
	:host .hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		image-orientation: none;
	}
</style>
<canvas class="graph"></canvas>
<div class="controls"></div>

<img class="hidden"/>
<canvas class="hidden"></canvas>
`


var igImageGraph = 
module.igImageGraph = 
object.Constructor('igImageGraph', HTMLElement, {
	template: 'ig-image-graph',
	graphs: {
		waveform,
		histogram,
	},
	modes: ['luminance', 'color', 'R', 'G', 'B'],
	color_modes: ['normalized', 'white', 'point'],

	__init__: function(src){
		// shadow DOM
		var shadow = this.__shadow = 
			this.attachShadow({mode: 'open'})
		// get/create template...
		var tpl = document.getElementById(this.template)
		if(!tpl){
			var tpl = document.createElement('template')
			tpl.setAttribute('id', this.template)
			tpl.innerHTML = igImageGraph_template 
			document.head.appendChild(tpl) }
		shadow.appendChild(tpl.content.cloneNode(true)) },
	connectedCallback: function(){
		this.update_controls()
		this.image 
			|| this.update() },

	// attributes...
	get observedAttributes(){
		return [
			'src', 
			'mode', 
			'color',
			'graph',
			'orientation',
			'flipped',
			'nocontrols',
		]},
	attributeChangedCallback: function(name, from, to){
		name == 'nocontrols'
			&& this.update_controls()
		this.update() },

	get graph(){
		return this.getAttribute('graph') || 'waveform' },
	set graph(value){
		value in this.graphs
			&& this.setAttribute('graph', value)
		value == ''
			&& this.removeAttribute('graph') 
		this.update() },
	get src(){
		return this.getAttribute('src') },
	// XXX make this async...
	set src(value){
		var that = this
		this.__update_handler = this.__update_handler 
			|| this.update.bind(this)
		var url = typeof(value) == typeof('str')
		// get/create image...
		var img = this.image = 
			url ?
				//(this.image || document.createElement('img'))
				// XXX HACK: image-orientation only works if element is attached to DOM...
				(this.image || this.__shadow.querySelector('img'))
				: value
		img.removeEventListener('load', this.__update_handler)
		img.addEventListener('load', this.__update_handler)
		// set .src and img.src...
		this.setAttribute('src', 
			url ? 
				(img.src = value)
				: img.src) },
	get mode(){
		return this.getAttribute('mode') 
			|| 'color' },
	set mode(value){
		this.modes.includes(value)	
			&& this.setAttribute('mode', value) 
		value === undefined
			&& this.removeAttribute('color') 
		this.update_controls()
		this.update() },
	get color(){
		return this.getAttribute('color') 
			|| 'normalized' },
	set color(value){
		this.color_modes.includes(value)	
			&& this.setAttribute('color', value) 
		value === undefined
			&& this.removeAttribute('color') 
		this.update() },

	get orientation(){
		return this.getAttribute('orientation') 
			|| 0 },
	set orientation(value){
		;(['top', 'left', 'bottom', 'right'].includes(value)
				|| typeof(value) == typeof(123))
			&& this.setAttribute('orientation', value) 
		value == null
			&& this.removeAttribute('orientation') 
		this.update() },
	get flipped(){
		return this.getAttribute('flipped') },
	set flipped(value){
		;(['vertical', 'horizontal', 'both'].includes(value)
				|| typeof(value) == typeof(123))
			&& this.setAttribute('flipped', value) 
		value == null
			&& this.removeAttribute('flipped') 
		this.update() },

	get nocontrols(){
		return this.getAttribute('nocontrols') != null },
	set nocontrols(value){
		value ?
			this.setAttribute('nocontrols', '')
   			: this.removeAttribute('nocontrols') 
		this.update_controls()
		this.update() },

	// API...
	update_controls: function(){
		var that = this
		var mode = this.mode

		var controls = this.__shadow.querySelector('.controls')
		controls.innerHTML = ''
		// modes...
		var buttons = [
				// graph...
				function(){
					var button = document.createElement('button')
					button.classList.add('update')
					//button.innerHTML = '&#9681;'
					button.innerHTML = '&#9706;'
					button.onclick = function(){ 
						var g = that.graph = that.graph == 'waveform' ?
							'histogram'
							: 'waveform'
						var b = button.parentElement.querySelector('#orientation-button') || {}
						b.disabled = that.graph != 'waveform' }
					return button }(),
				// orientation...
				//
				// switch from vertical to horizontal and back, keeping 
				// only two orientations with top-to-top (default) and 
				// top-to-right (alternative) modes.
				//
				// the button arrow:
				// 	- indicates orientation
				// 	- points to top of image relative to waveform
				//
				function(){
					var button = document.createElement('button')
					button.setAttribute('id', 'orientation-button')
					button.classList.add('update')
					button.innerHTML = '&#129105;'
					// load button state...
					var _update = function(){
						Object.assign(button.style, 
							that.__rotated == null ?
								// top...
								{ 
									transform: '',
									marginTop: '-2px', 
								}
								// right...
								: {
									transform: 'rotate(90deg)',
									marginTop: '-1px',
								}) }
					_update()
					button.disabled = that.graph != 'waveform'
					// click -> do the rotation...
					button.onclick = function(){ 
						var o = that.__rotated
						var c = that.orientation*1

						that.orientation = o == null ?
							// rotate cw...
							(c + 90) % 360
							// restore...
							: o

						that.__rotated = o == null ?
							c
							: null
						_update() }
					return button }(),
				// modes...
				// ...generate mode toggles...
				...(this.nocontrols ? 
						[] 
						: this.modes)
					// mode buttons...
					.map(function(m){
						var button = document.createElement('button')
						button.innerText = m
						button.classList.add(m, 
							...(m == mode ? 
								['current'] 
								: []))
						button.onclick = function(){ 
							that.mode = m }
						return button }),
				// reload...
				/*/ XXX do we actually need this???
				function(){
					var button = document.createElement('button')
					button.classList.add('update')
					button.innerHTML = '&#10227;'
					button.onclick = function(){ that.update() }
					return button }(),
				//*/
			]
			.reverse()
			.forEach(function(button){
				controls.appendChild(button) })
		return this },
	// XXX add option to update graph in a worker...
	// XXX show a spinner while updating...
	update: function(){
		var that = this
		var mode = this.mode

		// controls...
		// remove...
		if(!this.nocontrols){
			var controls = this.__shadow.querySelector('.controls')
			// current button state...
			var button = controls.querySelector('button.'+this.mode) 
			button 
				&& button.classList.add('current') }

		if(this.image){
			var orientation = this.orientation
			orientation = parseFloat(
				{top: 180, left: 90, bottom: 0, right: 270}[orientation] 
				|| orientation)

			var canvas = this.__shadow.querySelector('canvas.graph')
			var tmp_canvas = this.__shadow.querySelector('canvas.hidden')

			// XXX configurable...
			this.graphs[this.graph](this.image, 
				canvas, tmp_canvas, 
				this.mode, 
				this.color, 
				Math.round(orientation),
				this.flipped)

		} else if(this.src){
			this.src = this.src }

		return this },
})
window.customElements.define('ig-image-graph', igImageGraph)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
