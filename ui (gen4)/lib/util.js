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
// 	x/y/z
// 	scale
// 	scaleX/scaleY
// 	origin
// 	originX/originY
//
// NOTE: pixel values are converted to numbers and back by default...
//
//
// XXX this should consist of:
// 		- transform string parser -> functions format
// 		- functions format generator ***
// 			- generate single value functions (scaleX(), translateZ(), ...)
// 			- optionally merge into multivalue funcs (scale(), translate3d(), ...)
// 		- transform string generator
//
// XXX BUG: does not work with empty initial state, i.e. without 
// 		transforms set...
// XXX this will get/set values only on the first element, is this correct???
// XXX how do we combine translate(..) and translate3d(..)???
jQuery.fn.transform = function(){
	var that = $(this)
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
	var origin_str = elem ? elem.style[prefix + 'transformOrigin'] : ''
	var transform_str = elem ? elem.style[prefix + 'transform'] : ''

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
		// empty elem...
		if(that.length == 0){
			return that
		}

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

			// new arg...
			} else if(arg in _transform_parse_func){
				_transform_parse_func[arg]
			}
		})

		var t = Object.keys(functions)
			.map(function(func){
				return func +'('+ functions[func].join(', ') + ')'
			})
			.join(' ')

		var o = (transform['origin'] && transform['origin'] != '') ?
			transform['origin']
				.map(function(e){
					return typeof(e) == typeof('str') ? e : e + 'px'
				}).join(' ')
			: ''

		that.css({
			'transform-origin': o,
			'transform' : t, 
		})
		/*
		elem.style.transformOrigin = o
		elem.style.transform = t
		*/
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




// convert a transform string to an object...
//
// Format:
// 	{
// 		<func>: [<arg>, ...],
// 		...
// 	}
//
// NOTE: this does not care about the semantics of the format, just the 
// 		general structure...
var transform2obj = function(str){
	var res = {}
	str = str || ''
	// parse the string...
	str
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

			res[func] = data
		})
	return res
}

// Convert the object similar in structure to the produced by 
// transform2obj(..) to a transform string...
//
// NOTE: this does not care about the actual semantics of the format, 
// 		e.g. argument units or function names...
var obj2transform = function(obj){
	return Object.keys(obj)
		.map(function(func){
			return func +'('+ obj[func].join(', ') + ')'
		})
		.join(' ')
} 


// XXX BUG: passing '' to an alias will clear ALL the aliased functions...
// 		...should clear only full matches...
// XXX BUG: setting a single arg alias will return string results...
// 			.x(123)		-> ['123px']	-> must be [123]
// 			.x()		-> [123]
// 			.translate3d(1,2,3)
// 						-> [1, 2, 3]
// 		NOTE: both set data correctly...
// XXX move the grammar out of this...
// XXX need:
// 		- a way to minimize this, i.e. get only full and minimal functions...
// 		- a way to get what was defined as-is...
// XXX might be a good idea to use aliases for getting stuff and not 
// 		just setting stuff...
// 			.x(123) -> set all the aliases
// 			.x()	-> search only the first match
var transformEditor = function(){
	var editor = {
		// data set...
		data: {},

		// function that directly edit the data...
		__direct: {},


		// methods...
		toString: function(){ return obj2transform(this.data) },
		// XXX this will not build the alias data...
		fromString: function(str){ this.data = transform2obj(str) },
	}
	var func = function(name, args){
		args = args || []
		editor.__direct[name] = function(val){
			var that = this
			// set...
			if(val != null && val != ''){
				val = val instanceof Array ? val : [val]
				var res = this.data[name] = this.data[name] || []
				// add units and general processing...
				val.map(function(arg, i){
					// special case, if an arg is undefined do not change it...
					if(arg === undefined){
						return 
					}
					var unit = args[i] || ''
					res[i] = typeof(arg) == typeof(123) 
							|| (typeof(arg) == typeof('str') 
								&& /^[0-9\.]+$/.test(arg)) ?
						arg + unit
						: arg
				})
				return res

			// delete...
			} else if(val == ''){
				delete this.data[name]

			// get...
			} else {
				var res = (this.data[name] || [])
					// remove default unit...
					.map(function(arg, i){
						var unit = args[i] || ''
						return arg.slice(-unit.length) == unit 
								|| /^[0-9\.]+$/.test(arg)?
							parseFloat(arg)
							: arg
					})
				return res
			}
		}
	}
	
	var alias = function(spec){
		// alias runner...
		var handler = function(alias, args){
			var that = this
			// we only care for the source argument and only it will get
			// passed next...
			// NOTE: this is the name of the called alias...
			var arg = args[spec[alias]]

			return Object.keys(spec).map(function(k){
					var i = spec[k]

					if(args.length == 0){
						return k in that.__direct ? 
							that.__direct[k].call(that) 
							: null
					}

					var a = []
					a[i] = arg

					return k in that.__direct ?
						that.__direct[k].call(that, a) 
						: null
				})
				.filter(function(e){ return e != null })
				.slice(-1)[0]
		}

		// setup the aliases...
		Object.keys(spec).forEach(function(k){
			var i = spec[k]

			var func = i instanceof Function ? i : handler

			// NOTE: we will pass the called alias name to the handler 
			// 		via 'this'...
			var f = editor[k]
			editor[k] = f ? 
				// wrap the original alias...
				function(){
					var args = args2array(arguments)
					// XXX do a full search through the alias values...
					if(args.length == 0 && k in this.__direct){
						return this.__direct[k].call(this)
					}

					var a = f.apply(this, args)
					var b = func.call(this, k, args)

					if(k in this.__direct){
						return this.__direct[k].call(this)
					}
					return b
				} 
				: function(){ 
					var args = args2array(arguments)
					return func.call(this, k, args) 
				}

		})
	}

	// XXX get these from grammar...
	func('translate', ['px', 'px'])
	func('translate3d', ['px', 'px', 'px'])
	func('translateX', ['px'])
	func('translateY', ['px'])
	func('translateZ', ['px'])
	alias({ translate3d: 0, translate: 0, translateX: 0, x: 0 })
	alias({ translate3d: 1, translate: 1, translateY: 0, y: 0, })
	alias({ translate3d: 2, translateZ: 0, z: 0, }) 

	func('scale')
	func('scale3d')
	func('scaleX')
	func('scaleY')
	func('scaleZ')
	alias({ scale: 0, scale3d: 0, scaleX: 0, })
	alias({ scale: 1, scale3d: 1, scaleY: 0, })
	alias({ scale3d: 2, scaleZ: 0, })
	// special case: single arg scale: scale(n) -> scale(n, n)
	alias({ scale: function(){
		if(arguments.length == 1){
			return this.scale(arguments[0], arguments[0])
		}
		return this.__direct.scale.apply(this)
	} })

	func('rotate', ['deg'])
	func('rotate3d', ['px', 'px', 'px', 'deg'])
	func('rotateX', ['deg'])
	func('rotateY', ['deg'])
	func('rotateZ', ['deg'])

	func('matrix')
	func('matrix3d')

	func('skew')
	func('skewX')
	func('skewY')
	alias({skewX: 0, skew: 0})
	alias({skewY: 0, skew: 1})

	func('perspective')


	// non-transform functions...
	func('origin', ['px', 'px', 'px'])


	// proxy the undefined in aliases functions...
	Object.keys(editor.__direct).forEach(function(k){
		if(!(k in editor)){
			editor[k] = function(){ 
				var args = args2array(arguments)
				editor.__direct[k].apply(this, args.length > 0 ? [args]: [])
				return editor.__direct[k].call(this)
			}
		}
	})

	return editor
}

// XXX STUB: for testing only...
window.transformEditor = transformEditor

var transform = function(){
	var that = this
	var elem = $(this)[0]

	var args = args2array(arguments)
	// normalize...
	args = args.length == 0 
			|| typeof(args[0]) == typeof('str') ? args
		: args[0].constructor === Array 
			|| args.length == 1 ? args[0]
		: args

	// XXX do vendor tags...
	var prefix = ''

	// get the current state...
	var transform = transform2obj(elem && elem.style[prefix + 'transform'])
	var origin = (elem ? elem.style[prefix + 'transformOrigin'] : '').split(/\s+/)

	/* XXX not critical yet...
	var style = this.style.transformStyle
	var prespective = this.style.prespective
	var prespectiveOrigin = this.style.prespectiveOrigin
	var backfaceVisibility = this.style.backfaceVisibility
	*/

	// XXX populate transformEditor with current state...
	// XXX

	// get state...
	if(args.constructor === Array){
		// XXX minimize transformEditor and return
		// XXX

		// XXX
		return

	// set state...
	} else {
		// XXX add user inputs...
		// XXX

		// XXX minimize transformEditor and set...
		// XXX
	}

	return $(this)
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
