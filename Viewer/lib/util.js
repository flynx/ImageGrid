/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

require('object-run')


//---------------------------------------------------------------------
// Object...

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
	return res.unique() }


// Make a full key set copy of an object...
//
// NOTE: this will not deep-copy the values...
Object.flatCopy = function(obj){
	var res = {}
	Object.deepKeys(obj).forEach(function(key){
		res[key] = obj[key]
	})
	return res }



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


// first/last element access short-hands...
//
//	.first()
//	.last()
//		-> elem
//
//	.first(value)
//	.last(value)
//		-> array
//
// NOTE: setting a value will overwrite an existing first/last value.
// NOTE: for an empty array both .first(..)/.last(..) will return undefined 
// 		when getting a value and set the 0'th value when setting...
Array.prototype.first
	|| (Array.prototype.first = function(value){
		return arguments.length > 0 ?
			((this[0] = value), this)
			: this[0]})
Array.prototype.last
	|| (Array.prototype.last = function(value){
		return arguments.length > 0 ?
			((this[this.length - 1 || 0] = value), this)
			: this[this.length - 1]})


/*/ XXX not yet sure should these be funcs or props...
'first' in Array.prototype
	|| Object.defineProperty(Array.prototype, 'first', {
		enumerable: false,
		get : function () {
			return this[0] },
		set : function(value){
			this[0] = value 
			return this }, })

'last' in Array.prototype
	|| Object.defineProperty(Array.prototype, 'last', {
		enumerable: false,
		get : function () {
			return this[this.length - 1] },
		set : function(value){
			this[this.length - 1 || 0] = value 
			return this }, })
//*/


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
			return r }, {})
		: this.reduce(function(r, e, i){
			r[e] = i
			return r }, {}) }


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
				return m }, new Map())
		: this
			.reduce(function(m, e, i){
				m.set(e, i)
				return m }, new Map()) }


// Return an array with duplicate elements removed...
//
// NOTE: order is preserved... 
Array.prototype.unique = function(normalize){
	return normalize ? 
		[...new Map(this.map(function(e){ return [normalize(e), e] })).values()]
		: [...new Set(this)] }
Array.prototype.tailUnique = function(normalize){
	return this
		.slice()
		.reverse()
		.unique(normalize)
		.reverse() }

// Compare two arrays...
//
Array.prototype.cmp = function(other){
	if(this === other){
		return true }
	if(this.length != other.length){
		return false }
	for(var i=0; i<this.length; i++){
		if(this[i] != other[i]){
			return false } }
	return true }


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
			: i - j }) }



// Equivalent to .map(..) / .filter(..) / .reduce(..) / .forEach(..) that
// process the contents in chunks asynchronously...
//
//	.mapChunks(func)
//	.mapChunks(chunk_size, func)
//	.mapChunks([item_handler, chunk_handler])
//	.mapChunks(chunk_size, [item_handler, chunk_handler])
//		-> promise(list)
//	
//	.filterChunks(func)
//	.filterChunks(chunk_size, func)
//	.filterChunks([item_handler, chunk_handler])
//	.filterChunks(chunk_size, [item_handler, chunk_handler])
//		-> promise(list)
//	
//	.reduceChunks(func, res)
//	.reduceChunks(chunk_size, func, res)
//	.reduceChunks([item_handler, chunk_handler], res)
//	.reduceChunks(chunk_size, [item_handler, chunk_handler], res)
//		-> promise(res)
//
//
//	chunk_handler(chunk, result, offset)
//
//
// chunk_size can be:
// 	20			- chunk size
// 	'20'		- chunk size
// 	'20C'		- number of chunks
//	
//
// The main goal of this is to not block the runtime while processing a 
// very long array by interrupting the processing with a timeout...
//
var makeChunkIter = function(iter, wrapper){
	wrapper = wrapper
		|| function(res, func, array, e){
			return func.call(this, e[1], e[0], array) }
	return function(size, func, ...rest){
		var that = this
		var args = [...arguments]
		size = (args[0] instanceof Function 
				|| args[0] instanceof Array) ? 
			(this.CHUNK_SIZE || 50)
			: args.shift()
		size = typeof(size) == typeof('str') ?
				// number of chunks...
				(size.trim().endsWith('c') || size.trim().endsWith('C') ?
				 	Math.round(this.length / (parseInt(size) || 1)) || 1
				: parseInt(size))
			: size
		var postChunk
		func = args.shift()
		;[func, postChunk] = func instanceof Array ? func : [func]
		rest = args
		var res = []
		var _wrapper = wrapper.bind(this, res, func, this)

		return new Promise(function(resolve, reject){
				var next = function(chunks){
					setTimeout(function(){
						var chunk, val
						res.push(
							val = (chunk = chunks.shift())[iter](_wrapper, ...rest))
						postChunk
							&& postChunk.call(that, 
								chunk.map(function([i, v]){ return v }), 
								val,
								chunk[0][0])
						// stop condition...
						chunks.length == 0 ?
							resolve(res.flat(2))
							: next(chunks) }, 0) }
				next(that
					// split the array into chunks...
					.reduce(function(res, e, i){
						var c = res.slice(-1)[0]
						c.length >= size ?
							// initial element in chunk...
							res.push([[i, e]])
							// rest...
							: c.push([i, e])
						return res }, [[]])) }) } }

Array.prototype.CHUNK_SIZE = 50 
Array.prototype.mapChunks = makeChunkIter('map')
Array.prototype.filterChunks = makeChunkIter('map', 
	function(res, func, array, e){
		return !!func.call(this, e[1], e[0], array) ? [e[1]] : [] })
Array.prototype.reduceChunks = makeChunkIter('reduce',
	function(total, func, array, res, e){
		return func.call(this, 
			total.length > 0 ? 
				total.pop() 
				: res, 
			e[1], e[0], array) })



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
	return str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1') }



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

	date.prototype.toShortDate = function(show_ms){
		return '' 
			+ this.getFullYear()
			+'-'+ ('0'+(this.getMonth()+1)).slice(-2)
			+'-'+ ('0'+this.getDate()).slice(-2)
			+' '+ ('0'+this.getHours()).slice(-2)
			+':'+ ('0'+this.getMinutes()).slice(-2)
			+':'+ ('0'+this.getSeconds()).slice(-2)
			+ (show_ms ? 
				':'+(('000'+this.getMilliseconds()).slice(-3))
				: '') }
	date.prototype.getTimeStamp = function(show_ms){
		return '' 
			+ this.getFullYear()
			+ ('0'+(this.getMonth()+1)).slice(-2)
			+ ('0'+this.getDate()).slice(-2)
			+ ('0'+this.getHours()).slice(-2)
			+ ('0'+this.getMinutes()).slice(-2)
			+ ('0'+this.getSeconds()).slice(-2)
			+ (show_ms ? 
				('000'+this.getMilliseconds()).slice(-3)
				: '') }
	date.prototype.setTimeStamp = function(ts){
		ts = ts.replace(/[^0-9]*/g, '')
		this.setFullYear(ts.slice(0, 4))
		this.setMonth(ts.slice(4, 6)*1-1)
		this.setDate(ts.slice(6, 8))
		this.setHours(ts.slice(8, 10))
		this.setMinutes(ts.slice(10, 12))
		this.setSeconds(ts.slice(12, 14))
		this.setMilliseconds(ts.slice(14, 17) || 0)
		return this }
	date.timeStamp = function(...args){
		return (new this()).getTimeStamp(...args) }
	date.fromTimeStamp = function(ts){
		return (new this()).setTimeStamp(ts) }
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
