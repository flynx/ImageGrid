/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// convert JS arguments to Array...
var args2array =
module.args2array =
function(args){
	//return Array.apply(null, args)
	return [].slice.call(args)
}

// Quote a string and convert to RegExp to match self literally.
var quoteRegExp =
module.quoteRegExp =
function(str){
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
}


// XXX do we need to quote anything else???
var path2url =
module.path2url =
function(path){
	// test if we have a schema, and if yes return as-is...
	if(/^(http|https|file|[\w-]*):[\\\/]{2}/.test(path)){
		return path
	}
	// skip encoding windows drives...
	var drive = path.split(/^([a-z]:[\\\/])/i)
	path = drive.pop()
	drive = drive.pop() || ''
	return drive + (path
		.split(/[\\\/]/g)
		// XXX these are too aggressive...
		//.map(encodeURI)
		//.map(encodeURIComponent)
		.join('/')
		// NOTE: keep '%' the first...
		//.replace(/%/g, '%25')
		.replace(/#/g, '%23')
		.replace(/&/g, '%26'))
}


// NOTE: we are not using node's path module as we need this to work in
// 		all contexts, not only node... (???)
var normalizePath = 
module.normalizePath =
function(path){
	return typeof(path) == typeof('str') ? path
			// normalize the slashes...
			.replace(/(\/)/g, '/')
			// remove duplicate '/'
			.replace(/(\/)\1+/g, '/')
			// remove trailing '/'
			.replace(/\/+$/, '')
			// take care of .
			.replace(/\/\.\//g, '/')
			.replace(/\/\.$/, '')
			// take care of ..
			.replace(/\/[^\/]+\/\.\.\//g, '/')
			.replace(/\/[^\/]+\/\.\.$/, '')
		: path
}



/*********************************************************************/

var _transform_parse = {
	// 2d transforms:
	//martix: [],

	translate: ['left|0', 'top|0'],
	translateX: ['left'],
	translateY: ['top'],

	scale: [
		['scale'],
		['scaleX|scale', 'scaleY|scale'],
	],
	scaleX: ['scaleX'],
	scaleY: ['scaleY'],

	rotate: ['rotate'],
	
	skew: ['skewX', 'skewY'],
	skewX: ['skewX'],
	skewY: ['skewY'],

	// 3d transforms:
	//martix3d: [],

	translate3d: ['x|0', 'y|0', 'z|0'],
	translateZ: ['z'],

	scale3d: ['scaleX', 'scaleY', 'scaleZ'],
	scaleZ: ['scaleZ'],

	// XXX
	//rotate3d: [x, y, z, angle],
	// 	rotateX
	// 	rotateY
	// 	rotateZ
	
	perspective: ['perspective'],
}
var _transform_parse_rev = {}
Object.keys(_transform_parse).forEach(function(func){
	var args = _transform_parse[func]

	// we got multiple signatures == merge...
	if(!(args[0] instanceof Array)){
		args = [args]
	}

	args
		// merge lists of args...
		.reduce(function(a, b){ return [].concat.call(a, b) })
		.unique()
		// split alternatives...
		.map(function(a){ return a.split(/\|/g) })
		.forEach(function(a){
			var arg = a[0]
			var alt = a.slice(1)

			var e = _transform_parse_rev[arg] = _transform_parse_rev[arg] || {}

			e.funcs = e.funcs || []
			e.funcs.indexOf(func) < 0 && e.funcs.push(func)

			e.alt = e.alt || []
			// XXX we explicitly support only one alternative now...
			e.alt = e.alt.concat(alt).unique()
		})
})


// XXX get vendor...

// 
// 	Set element transform...
// 	.transform({..})
// 		-> element
//
// 	Get element transform...
// 	.transform()
// 	.transform(<attr>[, ...])
// 	.transform([<attr>, ...])
// 		-> data
//
// Supported transformations:
// 	x/y
// 	scale
// 	scaleX/scaleY
// 	origin
// 	originX/originY
//
// NOTE: pixel values are converted to numbers and back by default...
//
// XXX this will get/set values only on the first element, is this correct???
// XXX how do we combine translate(..) and translate3d(..)???
jQuery.fn.transform = function(){
	var that = this
	var args = args2array(arguments)

	// XXX get the browser prefix...
	var prefix = ''

	// normalize...
	args = args.length == 0 
			|| typeof(args[0]) == typeof('str') ? args
		: args[0].constructor === Array 
			|| args.length == 1 ? args[0]
		: args

	var elem = $(this)[0]
	var origin_str = elem.style[prefix + 'transformOrigin']
	var transform_str = elem.style[prefix + 'transform']

	// build the current state...
	// NOTE: we'll need this for both fetching (parsing) and writing 
	// 		(checking)...
	var transform = {}
	var functions = {}

	// origin...
	var origin = origin_str
		.split(/\s+/)
		// XXX add this to transform...

	// transform...
	transform_str
		// split functions...
		.split(/(\w+\([^\)]*)\)/)
		// remove empty strings...
		.filter(function(e){ return e.trim().length > 0})
		// split each function...
		.map(function(e){ return e
			// split args...
			.split(/\s*[\(,\s]\s*/)
			// cleanup...
			.filter(function(e){ return e.trim().length > 0 }) })
		// build the structure...
		.forEach(function(data){
			var func = data.shift() 
			var args = data

			// XXX do we care about function vendor tags here???
			var spec = _transform_parse[func]

			functions[func] = args

			// we do not know this function...
			if(spec == null){
				transform[func] = args

			} else {
				spec = spec[0] instanceof Array ? spec : [spec]
				spec.forEach(function(s){ 
					// skip non-matching signatures...
					// XXX is this correct???
					if(s.length != args.length){
						return
					}
					s.forEach(function(e, i){ 
						// this is for things that have optional arguments
						// like scale(..)
						// XXX should we treat this in some special way???
						if(args[i] == null){
							return
						}

						var alternatives = e.split(/\|/g)
						var k = alternatives.shift().trim()

						transform[k] = args[i].slice(-2) == 'px' 
								|| /[0-9\.]+/.test(args[i]) ?
							parseFloat(args[i]) 
							: args[i] 
					})
				})
			}
		})


	// get data...
	if(args.constructor === Array){
		var res = {}

		// return the full transform...
		if(args.length == 0){
			return transform
		}

		args.forEach(function(arg){
			// direct match in shorthand data...
			if(arg in transform){
				res[arg] = transform[arg]

			// try and find an alias...
			} else if(arg in _transform_parse_rev){
				var funcs = _transform_parse_rev[arg].funcs
				var alt = _transform_parse_rev[arg].alt[0]

				// no alternatives...
				if(!alt){
					res[arg] = ''

				// explicit number value...
				} else if(/^[0-9\.]+$/.test(alt)){
					res[arg] = parseFloat(alt)

				// explicit string value...
				} else if(/^(['"]).*\1$/.test(alt)){
					res[arg] = alt.slice(1, -1)

				} else {
					var v = $(that).transform(alt)
					res[arg] = v == '' ? alt : v
				}


			// collect from function...
			} else if(arg in _transform_parse){
				var v = res[arg] = {}
				_transform_parse[arg].forEach(function(e){
					var alternatives = e.split(/\|/g)
					var k = alternatives.shift().trim()

					v[k] = transform[k] != null ? transform[k] : ''
				})

			// don't know about this attr...
			} else {
				res[arg] = ''
			}
		})

		// special case: we asked for a single value...
		if(args.length == 1){
			return res[args[0]]
		}
		return res
	
	// set data...
	} else {
		transform = Object.create(transform)
		Object.keys(args).forEach(function(key){
			// the changing value already exists...
			if(key in transform
					// get one of the shorthand keys...
					// NOTE: we might need to pack or re-pack the date but we 
					// 		can't decide here...
					|| key in _transform_parse_rev
					// got one of the standard keys...
					|| key in _transform_parse){
				transform[key] = args[key]

			// key undefined...
			} else {
				console.warn('Ignoring key "%s".', key)
				transform[key] = args[key]
			}
		})


		console.log('>>>>', transform)

		// XXX set new values and resolve new functions...
		// XXX
		

		// build the value string...
		var transform_str = ''
		for(var f in functions){
			transform_str += f +'('
				+(functions[f]
					// XXX test if px value...
					.map(function(e){ return typeof(e) == typeof(123) ? e + 'px' : e })
					.join(', '))+') '
		}

		console.log(transform_str)

		// XXX STUB
		return functions

		// set the values...
		elem.style.transform = transform_str
		elem.style.transformOrigin = origin_str
	}

	return $(this)
}

// shorthands...
jQuery.fn.scale = function(value){
	if(value){
		return $(this).transform({scale: value})
	} else {
		return $(this).transform('scale')
	}
}
jQuery.fn.origin = function(value){
	if(value){
		return $(this).transform({origin: value})
	} else {
		return $(this).transform('origin')
	}
}


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
