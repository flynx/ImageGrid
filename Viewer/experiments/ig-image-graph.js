//---------------------------------------------------------------------
//
//
// XXX still thinking on how to package this correctly...
//
//---------------------------------------------------------------------
// image manipulation basics...

var Filters = {
	makeCanvas: function(w, h){
		var c = document.createElement('canvas')
		c.width = w
		c.height = h
		return c },

	// as input takes an HTML Image object...
	getPixels: function(img, w, h){
		var w = w || img.width
		var h = h || img.height
		var c = this.makeCanvas(w, h)
		var context = c.getContext('2d')
		if(img == null){
			context.rect(0, 0, w, h)
			context.fillStyle = "black"
			context.fill()
		} else {
			context.drawImage(img, 0, 0, w, h) }
		return context.getImageData(0,0,c.width,c.height) },
	setPixels: function(c, data, w, h){
		c.width = data.width
		c.height = data.height
		var context = c.getContext('2d')
		context.putImageData(data, 0, 0) },

	filterImage: function(filter, image, var_args){
		var args = [this.getPixels(image)]
		for(var i=2; i<arguments.length; i++){
			args.push(arguments[i])
		}
		return filter.apply(null, args) },

	grayscale: function(pixels, args){
		var d = pixels.data
		for(var i=0; i<d.length; i+=4){
			var r = d[i]
			var g = d[i+1]
			var b = d[i+2]
			// CIE luminance for the RGB
			// The human eye is bad at seeing red and blue, so we de-emphasize them.
			var v = 0.2126*r + 0.7152*g + 0.0722*b
			d[i] = d[i+1] = d[i+2] = v }
		return pixels },
	// XXX need to resize this...
	histogram: function(pixels, mode, color){
		color = color || 'fill'
		mode = mode || 'luminance'

		var w = 255 
		var h = 255 

		// output buffer...
		var out = this.getPixels(null, w, h)

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
				if(mode == 'color' || mode == 'R'){
					count[r*4] = (count[r*4] || 0) + 1 }
				if(mode == 'color' || mode == 'G'){
					count[g*4+1] = (count[g*4+1] || 0) + 1 }
				if(mode == 'color' || mode == 'B'){
					count[b*4+2] = (count[b*4+2] || 0) + 1 } } }

		var m = 255 / Math.max(...count.filter(function(){ return true }))

		var pos = function(i, value){
			return (
				// horizontal position...
				i*4 
				// value vertical offset...
				+ (255-Math.round(value*m))*w*4) }

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
		mode = mode || 'luminance'
		color = color || 'normalized'

		var w = pixels.width

		// normalize pixel ratio...
		var m = (1/pixels.height)*255

		var offsetTop = 0
		var offsetBottom = 0

		// output buffer...
		var out = this.getPixels(null, 
			w, 
			offsetTop + 255 + offsetBottom)

		// pixel hit buffer...
		var count = []

		var od = out.data
		var d = pixels.data

		var pos = function(i, value){
			return (
				// top margin...
				offsetTop*w*4 
				// horixontal position...
				+ i%(w*4)
				// value vertical offset...
				+ (255-Math.round(value))*w*4) }

		var gain = 100

		for(var i=0; i<d.length; i+=4){

			var r = d[i]
			var g = d[i+1]
			var b = d[i+2]
			var c, j, f, x, y


			if(mode == 'luminance'){
				// CIE luminance for RGB
				var v = 0.2126*r + 0.7152*g + 0.0722*b
				c = count[j = pos(i, v)] = (count[j] || 0) + m
				od[j] = od[j+1] = od[j+2] = c * gain

			} else {
				if(mode == 'color' || mode == 'R'){
					f = 0.2126
					x = 1
					y = 2
					j = pos(i, r)
					c = count[j] = (count[j] || 0) + m
					od[j] = c * gain }
				if(mode == 'color' || mode == 'G'){
					f = 0.7152
					x = -1
					y = 1
					j = pos(i, g) + 1
					c = count[j] = (count[j] || 0) + m
					od[j] = c * gain }
				if(mode == 'color' || mode == 'B'){
					f = 0.0722
					x = -2
					y = -1
					j = pos(i, b) + 2
					c = count[j] = (count[j] || 0) + m
					od[j] = c * gain }

				// normalize...
				mode != 'color'
					&& (color == 'white' ?
							(od[j+x] = od[j+y] = c * gain)
						: color == 'normalized' ?
							(od[j+x] = od[j+y] = c * gain/2 * (1-f))
						: null) } }
		return out },
}



//---------------------------------------------------------------------
// helpers...

var WAVEFORM_SIZE = 1000
var waveform = function(img, canvas, mode, color){
	var d = Filters.getPixels(img, WAVEFORM_SIZE)
	var w = Filters.waveform(d, mode, color)
	Filters.setPixels(canvas, w) }

var HISTOGRAM_SIZE = 1000
var histogram = function(img, canvas, mode, color){
	var d = Filters.getPixels(img)
	var w = Filters.histogram(d, mode, color)
	Filters.setPixels(canvas, w) }



//---------------------------------------------------------------------
// Custom element...

igImageGraph_template = `
<style>
	:host {
		position: relative;
		display: inline-block;

		background: black;

		width: attr(image-width);
		height: attr(graph-height);
	}
	:host canvas {
		box-sizing: border-box;
		width: 100%;
		height: 100%;

		border: 2px solid gray;
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
	}
	:host .controls button.current {
		text-decoration: underline;
		opacity: 0.9;
	}
	:host .controls button:hover {
		opacity: 1;
	}
</style>
<canvas class="graph"></canvas>
<div class="controls"></div>
`

class igImageGraph extends HTMLElement {
	template = 'ig-image-graph'
	graphs = {
		waveform,
		histogram,
	}
	modes = ['luminance', 'color', 'R', 'G', 'B']
	color_modes = ['normalized', 'white', 'point']

	constructor(src){
		super()
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
		shadow.appendChild(tpl.content.cloneNode(true)) }
	connectedCallback(){
		this.update_controls()
		this.update() }

	// attributes...
	get observedAttributes(){
		return [
			'src', 
			'mode', 
			'color',
			'nocontrols',
			'graph',
		]}
	attributeChangedCallback(name, from, to){
		name == 'nocontrols'
			&& this.update_controls()
		this.update() }

	get graph(){
		return this.getAttribute('graph') || 'waveform' }
	set graph(value){
		value in this.graphs
			&& this.setAttribute('graph', value)
		value == ''
			&& this.removeAttribute('graph') 
		this.update() }
	get src(){
		return this.getAttribute('src') }
	set src(value){
		var that = this
		this.__update_handler = this.__update_handler 
			|| this.update.bind(this)
		var url = typeof(value) == typeof('str')
		// get/create image...
		var img = this.image = 
			url ?
				(this.image || document.createElement('img'))
				: value
		img.removeEventListener('load', this.__update_handler)
		img.addEventListener('load', this.__update_handler)
		// set .src and img.src...
		this.setAttribute('src', 
			url ? 
				(img.src = value)
				: img.src) }
	get mode(){
		return this.getAttribute('mode') || 'color' }
	set mode(value){
		this.modes.includes(value)	
			&& this.setAttribute('mode', value) 
		value === undefined
			&& this.removeAttribute('color') 
		this.update_controls()
		this.update() }
	get color(){
		return this.getAttribute('color') || 'normalized' }
	set color(value){
		this.color_modes.includes(value)	
			&& this.setAttribute('color', value) 
		value === undefined
			&& this.removeAttribute('color') 
		this.update() }
	get nocontrols(){
		return this.getAttribute('nocontrols') != null }
	set nocontrols(value){
		value ?
			this.setAttribute('nocontrols', '')
   			: this.removeAttribute('nocontrols') 
		this.update_controls()
		this.update() }

	// API...
	update_controls(){
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
						that.graph = that.graph == 'waveform' ?
							'histogram'
							: 'waveform'
						that.update() }
					return button }(),
				// modes...
				(this.nocontrols ? 
						[] 
						: this.modes)
					// mode buttons...
					.map(function(m){
						var button = document.createElement('button')
						button.innerText = m
						button.classList.add(m, ...(m == mode ? ['current'] : []))
						button.onclick = function(){ 
							that.mode = m }
						return button }),
				/* 
				// color mode switch...
				function(){
					var button = document.createElement('button')
					button.innerText = '('+ that.color[0] +')'
					button.onclick = function(){ 
						that.color = that.color_modes[
							(that.color_modes.indexOf(that.color) + 1) 
								% that.color_modes.length]
						this.innerText = '('+ that.color[0] +')' }
					return button }(),
					//*/
				// reload...
				function(){
					var button = document.createElement('button')
					button.classList.add('update')
					button.innerHTML = '&#10227;'
					button.onclick = function(){ that.update() }
					return button }(),
			]
			.flat()
			.reverse()
			.forEach(function(button){
				controls.appendChild(button) })
		return this }
	update(){
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

		// XXX configurable...
		var type = this.graph
		var graph = this.graphs[type]

		var canvas = this.__shadow.querySelector('canvas')

		if(this.image){
			graph(this.image, canvas, this.mode, this.color)

		} else if(this.src){
			this.src = this.src }

		return this }
}
window.customElements.define('ig-image-graph', igImageGraph)

var makeImageGraph = function(img, options){
	var g = document.createElement('ig-image-graph')
	Object.assign(g, 
		options || {})
	g.src = img
	return g }



//---------------------------------------------------------------------
//                                                 vim:set ts=4 sw=4 :
