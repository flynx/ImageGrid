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

// func -> [{attr|alt: unit, ..}, ..]
var _transform_parse = {
	// 2d transforms:
	//martix: [],

	translate: [{'left|0': 'px', 'top|0': 'px'}],
	translateX: [{'left|x': 'px'}],
	translateY: [{'top|y': 'px'}],

	scale: [
		{scale: null},
		{'scaleX|scale': null, 'scaleY|scale': null},
	],
	scaleX: [{'scaleX': null}],
	scaleY: [{'scaleY': null}],

	rotate: [{'rotate': 'deg'}],
	
	skew: [{'skewX': 'px', 'skewY': 'px'}],
	skewX: [{'skewX': 'px'}],
	skewY: [{'skewY': 'px'}],

	// 3d transforms:
	//martix3d: [],

	translate3d: [{'x|0': 'px', 'y|0': 'px', 'z|0': 'px'}],
	translateZ: [{'z': 'px'}],

	scale3d: [{'scaleX': null, 'scaleY': null, 'scaleZ': null}],
	scaleZ: [{'scaleZ': null}],

	// XXX
	//rotate3d: [x, y, z, angle]],
	// 	rotateX
	// 	rotateY
	// 	rotateZ
	
	perspective: [{'perspective': null}],
}


// attr -> [alt, ..]
var _transform_parse_alt = {}
// attr -> [func, ..]
var _transform_parse_func = {}
Object.keys(_transform_parse).forEach(function(func){
	_transform_parse[func].forEach(function(variant){
		Object.keys(variant).forEach(function(arg){
			var alt = arg.split(/\|/g)
			var arg = alt.shift()

			_transform_parse_func[arg] = _transform_parse_func[arg] || []
			_transform_parse_func[arg].push(func)
			_transform_parse_alt[arg] = _transform_parse_alt[arg] || []

			if(alt.length > 0){
				_transform_parse_alt[arg] = (_transform_parse_alt[alt] || [])
					.concat(alt)
					.unique()
			}
		})
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

	// origin...
	var origin = origin_str
		.split(/\s+/)
		// XXX add this to transform...

	// build the current state...
	// NOTE: we'll need this for both fetching (parsing) and writing 
	// 		(checking)...
	var transform = {}
	var functions = {}
	var attrs = {}
	//var implicit = {}
	//var implicit_attrs = {}

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
				transform[func] = [args]

			} else {
				var seen = []
				transform[func] = []
				var proc = function(res, attrs, explicit){
					return function(s){ 
						var keys = Object.keys(s)
						// skip non-matching signatures...
						// XXX is this correct???
						if(explicit && keys.length != args.length){
							return
						}

						var data = {}
						res.push(data)

						keys.forEach(function(e, i){
							if(args[i] == null){
								return
							}

							var alternatives = e.split(/\|/g)
							var k = alternatives.shift().trim()

							var val = args[i].slice(-2) == 'px' 
									|| /^[0-9\.]+$/.test(args[i]) ?
								parseFloat(args[i]) 
								: args[i] 

							var unit = args[i].split(val+'').pop()

							attrs[k] = function(v, d){
								v = v || val
								d = d || data

								// set attrs -- for getting data...
								d[k] = v
								// set funcs -- for setting data...
								functions[func][i] = typeof(v) == typeof('str') ?
									v
									: v + unit

								return v
							}
							attrs[k]()
						})
					}
				}
				spec.forEach(proc(transform[func], attrs, true))
			}
		})

	// handler origin...
	if(origin_str != ''){
		transform['origin'] = [origin_str.split(/\s+/g)
			.map(function(e){
				return e.slice(-2) == 'px' 
						|| /^[0-9\.]+$/.test(e) ?
					parseFloat(e) 
					: e 
			})]
	}

	// get data...
	// 	functions -> transform
	if(args.constructor === Array){
		var res = {}

		// get everything set...
		if(args.length == 0){
			Object.keys(attrs).forEach(function(k){ attrs[k](null, res) })
			return res
		}

		args.forEach(function(arg){
			do {
				// we got an explicitly defined attr name...
				if(arg in attrs){
					res[arg] = attrs[arg]()
					break
				}

				// we got a explicit function name...
				if(arg in transform){
					res[arg] = transform[arg][0]
					break
				}

				// we got an implicitly defined function...
				if(arg in _transform_parse){
					// XXX
				}

				// search for aliases...
				if(arg in _transform_parse_alt){
					arg = _transform_parse_alt[arg][0] 
				}

				break
			} while(arg in _transform_parse_alt 
				|| arg in attrs 
				|| arg in transform)
		})
		
		if(args.length == 1){
			return res[Object.keys(res)[0]]
		}
		return res
	
	// set data...
	// 	transform -> functions
	} else {
		Object.keys(args).forEach(function(arg){
			var val = args[arg]

			// special case: origin...
			if(arg == 'origin'){
				transform['origin'] = val

			// full function...
			} else if(arg in _transform_parse){
				if(val == ''){
					delete functions[arg]

				} else {
					val = val instanceof Array ? val : [val]
					var units = _transform_parse[arg]
						.filter(function(s){ 
							return Object.keys(s).length == val.length })[0]
					functions[arg] = val.map(function(a, i){ 
						var u = units[Object.keys(units)[i]] || ''
						return typeof(a) != typeof('str') ? a + u : a })
				}


			// got an arg...
			} else if(arg in attrs){
				attrs[arg](val)
			}
		})

		elem.style.transform = Object.keys(functions)
			.map(function(func){
				return func +'('+ functions[func].join(', ') + ')'
			})
			.join(' ')

		elem.style.transformOrigin = transform['origin'] != '' ?
			transform['origin']
				.map(function(e){
					return typeof(e) == typeof('str') ? e : e + 'px'
				}).join(' ')
			: ''
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
jQuery.fn.origin = function(a, b, c){
	if(a && b && c){
		return $(this).transform({origin: [a, b, c]})
	} else if(a == '' || a instanceof Array){
		return $(this).transform({origin: a})
	} else {
		return $(this).transform('origin')
	}
}


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
