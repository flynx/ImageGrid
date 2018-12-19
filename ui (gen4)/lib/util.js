/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/


//---------------------------------------------------------------------
// Object...

// Run a function in the context of an object...
//
Object.defineProperty(Object.prototype, 'run', {
	enumerable: false,
	value: function(func){
		var res = func ? func.call(this) : undefined
		return res === undefined ? this : res
	},
})


// Get all the accessible keys...
//
// This is different to Object.keys(..) in that this will return keys
// from all the prototypes in the inheritance chain while .keys(..) will 
// only return the keys defined in the current object only.
Object.deepKeys = function(obj){
	var res = []
	while(obj != null){
		res = res.concat(Object.keys(obj))
		obj = obj.__proto__
	}
	return res.unique()
}


// Make a full key set copy of an object...
//
// NOTE: this will not deep-copy the values...
Object.flatCopy = function(obj){
	var res = {}
	Object.deepKeys(obj).forEach(function(key){
		res[key] = obj[key]
	})
	return res
}



//---------------------------------------------------------------------
// Array...

// Array.prototype.flat polyfill...
//
// NOTE: .flat(..) is not yet supported in IE/Edge...
Array.prototype.flat
	|| (Array.prototype.flat = function(depth){
		depth = typeof(depth) == typeof(123) ? depth : 1
		return this.reduce(function(res, e){ 
			return res.concat(e instanceof Array && depth > 0 ? 
				e.flat(depth-1) 
				: [e]) }, []) })


// Array.prototype.includes polyfill...
//
Array.prototype.includes
	|| (Array.prototype.includes = function(value){
		return this.indexOf(value) >= 0 }) 


// Compact a sparse array...
//
// NOTE: this will not compact in-place.
Array.prototype.compact = function(){
	return this.filter(function(){ return true }) }


// like .length but for sparse arrays will return the element count...
'len' in Array.prototype
	|| Object.defineProperty(Array.prototype, 'len', {
		get : function () {
			return Object.keys(this).length
		},
		set : function(val){},
	})


// Convert an array to object...
//
// Format:
// 	{
// 		<item>: <index>,
// 		...
// 	}
//
// NOTE: items should be strings, other types will get converted to 
// 		strings and thus may mess things up.
// NOTE: this will forget repeating items...
// NOTE: normalize will slow things down...
Array.prototype.toKeys = function(normalize){
	return normalize ? 
		this.reduce(function(r, e, i){
			r[normalize(e)] = i
			return r
		}, {})
		: this.reduce(function(r, e, i){
			r[e] = i
			return r
		}, {}) }


// Convert an array to a map...
//
// This is similar to Array.prototype.toKeys(..) but does not restrict 
// value type to string.
//
// Format:
// 	Map([
// 		[<item>, <index>],
// 		...
// 	])
//
// NOTE: this will forget repeating items...
// NOTE: normalize will slow things down...
Array.prototype.toMap = function(normalize){
	return normalize ? 
		this
			.reduce(function(m, e, i){
				m.set(normalize(e), i)
				return m
			}, new Map())
		: this
			.reduce(function(m, e, i){
				m.set(e, i)
				return m
			}, new Map()) }


// Return an array with duplicate elements removed...
//
// NOTE: we are not using an Object as an index here as an Array can 
// 		contain any type of item while Object keys can only be strings...
// NOTE: for an array containing only strings use a much faster .uniqueStrings(..)
// NOTE: this may not work on IE...
Array.prototype.unique = function(normalize){
	return normalize ? 
		[...new Map(this.map(function(e){ return [normalize(e), e] })).values()]
		: [...(new Set(this))] }


// Compare two arrays...
//
Array.prototype.cmp = function(other){
	if(this === other){
		return true
	}
	if(this.length != other.length){
		return false
	}
	for(var i=0; i<this.length; i++){
		if(this[i] != other[i]){
			return false
		}
	}
	return true
}


// Compare two Arrays as sets...
//
// This will ignore order
//
// XXX should we use Set(..) here???
Array.prototype.setCmp = function(other){
	return this === other 
		|| this
			.unique()
			.sort()
			.cmp(other
				.unique()
				.sort()) }


Array.prototype.sortAs = function(other){
	return this.sort(function(a, b){
		var i = other.indexOf(a)
		var j = other.indexOf(b)
		return i < 0 && j < 0 ? 0
			: i < 0 ? 1
			: j < 0 ? -1
			: i - j
	})
}



//---------------------------------------------------------------------
// Set...

// Set set operation shorthands...
Set.prototype.unite = function(other){ 
	return new Set([...this, ...other]) }
Set.prototype.intersect = function(other){
	var test = other.has ?  'has' : 'includes'
	return new Set([...this]
		.filter(function(e){ return other[test](e) })) }
Set.prototype.subtract = function(other){
	other = new Set(other)
	return new Set([...this]
		.filter(function(e){ return !other.has(e) })) }


//---------------------------------------------------------------------
// RegExp...

// Quote a string and convert to RegExp to match self literally.
var quoteRegExp =
RegExp.quoteRegExp =
module.quoteRegExp =
function(str){
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
}



//---------------------------------------------------------------------
// String...

String.prototype.capitalize = function(){
	return this == '' ? 
		this 
		: this[0].toUpperCase() + this.slice(1) }



//---------------------------------------------------------------------
// Date...

// NOTE: repatching a date should not lead to any side effects as this
// 		does not add any state...
var patchDate =
module.patchDate = function(date){
	date = date || Date

	date.prototype.toShortDate = function(){
		var y = this.getFullYear()
		var M = this.getMonth()+1
		M = M < 10 ? '0'+M : M
		var D = this.getDate()
		D = D < 10 ? '0'+D : D
		var H = this.getHours()
		H = H < 10 ? '0'+H : H
		var m = this.getMinutes()
		m = m < 10 ? '0'+m : m
		var s = this.getSeconds()
		s = s < 10 ? '0'+s : s

		return ''+y+'-'+M+'-'+D+' '+H+':'+m+':'+s
	}
	date.prototype.getTimeStamp = function(no_seconds){
		var y = this.getFullYear()
		var M = this.getMonth()+1
		M = M < 10 ? '0'+M : M
		var D = this.getDate()
		D = D < 10 ? '0'+D : D
		var H = this.getHours()
		H = H < 10 ? '0'+H : H
		var m = this.getMinutes()
		m = m < 10 ? '0'+m : m
		var s = this.getSeconds()
		s = s < 10 ? '0'+s : s

		return ''+y+M+D+H+m+s
	}
	date.prototype.setTimeStamp = function(ts){
		ts = ts.replace(/[^0-9]*/g, '')
		this.setFullYear(ts.slice(0, 4))
		this.setMonth(ts.slice(4, 6)*1-1)
		this.setDate(ts.slice(6, 8))
		this.setHours(ts.slice(8, 10))
		this.setMinutes(ts.slice(10, 12))
		this.setSeconds(ts.slice(12, 14))
		return this
	}
	date.timeStamp = function(){
		return (new this()).getTimeStamp()
	}
	date.fromTimeStamp = function(ts){
		return (new this()).setTimeStamp(ts)
	}
	// convert string time period to milliseconds...
	date.str2ms = function(str, dfl){
		dfl = dfl || 'ms'

		if(typeof(str) == typeof(123)){
			var val = str
			str = dfl

		} else {
			var val = parseFloat(str)
			str = str.trim()

			// check if a unit is given...
			str = str == val ? dfl : str
		}
		
		var c = /(m(illi)?(-)?s(ec(ond(s)?)?)?)$/i.test(str) ? 1
			: /s(ec(ond(s)?)?)?$/i.test(str) ? 1000
			: /m(in(ute(s)?)?)?$/i.test(str) ? 1000*60
			: /h(our(s)?)?$/i.test(str) ? 1000*60*60
			: /d(ay(s)?)?$/i.test(str) ? 1000*60*60*24
			: null

		return c ? val * c : NaN
	}

	return date
}
// patch the root date...
patchDate()



//---------------------------------------------------------------------
// Misc...

module.chainCmp = function(cmp_chain){
	return function(a, b, get, data){
		var res
		for(var i=0; i < cmp_chain.length; i++){
			res = cmp_chain[i](a, b, get, data)
			if(res != 0){
				return res
			}
		}
		return res
	}
} 


// XXX do we need to quote anything else???
var path2url =
module.path2url =
function(path){
	// test if we have a schema, and if yes return as-is...
	if(/^(data|http|https|file|[\w-]*):[\\\/]{2}/.test(path)){
		return path
	}
	// skip encoding windows drives...
	path = path
		.split(/[\\\/]/g)
	drive = path[0].endsWith(':') ?
		path.shift() + '/'
		: ''
	return drive + (path
		// XXX these are too aggressive...
		//.map(encodeURI)
		//.map(encodeURIComponent)
		.join('/')
		// NOTE: keep '%' the first...
		.replace(/%/g, '%25')
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
			.replace(/\\/g, '/')
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




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
