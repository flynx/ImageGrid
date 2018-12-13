/**********************************************************************
* 
* Goals:
* 	- minimum tagging
* 	- maximum expressiveness
* 	- fully serializable
* 	- customizable
*
* Features:
* 	- tag paths
* 		a/b/c
* 	- tag sets/relations
* 		a:b
* 	- serializable tag queries (text/json)
* 	- serializable tag data
*
*
* TODO:
* 	- investigate support for sqlite3
* 		- will it be faster?
*
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')
var util = require('lib/util')



/*********************************************************************/
// Helpers...

// normalize a split to either contain multiple values or a list...
var splitOrList = function(args){
	return (args.length == 1 && args[0] instanceof Array) ? 
		args.pop() 
		: args }



/*********************************************************************/

var TagsClassPrototype = {
	// Utils...
	//
	// 	.normalize(tag)
	// 		-> ntag
	//
	// 	.normalize(tag, ...)
	// 	.normalize([tag, ...])
	// 		-> [ntag, ...]
	//
	// NOTE: tag set order is not significant.
	// NOTE: for mixed tags sets are sorted in-place within paths, 
	// 		e.g.
	// 			c:b/a -> b:c/a
	//
	// XXX not sure if we should do:
	// 			c:b/a -> b:c/a 		- sort sets within pats (current)
	// 		or
	// 			c:b/a -> b/a:c		- sort paths within sets
	// XXX should we support priority braces, i.e. c:(b/a)
	// XXX do we support leading '/' ???
	normalize: function(...tags){
		var that = this
		var tagRemovedChars = (this.config || {})['tagRemovedChars']
		tagRemovedChars = tagRemovedChars instanceof RegExp ? 
				tagRemovedChars
			: typeof(tagRemovedChars) == typeof('str') ?
				new RegExp(tagRemovedChars, 'g')
			: /[\s-_]/g
		var res = splitOrList(tags)
			.map(function(tag){
				return tag
					.trim()
					.toLowerCase()
					.replace(tagRemovedChars, '')
					// sort sets within paths...
					.split(/[\\\/]+/g)
						.map(function(e){
							return e
								.split(/:+/g)
								// remove empty set members...
								.filter(function(t){ 
									return t != '' })
								.unique()
								.sort()
								.join(':') })
						// NOTE: this also kills the leading '/'
						.filter(function(t){ 
							return t != '' })
						.join('/') })
			.unique()
		return (tags.length == 1 && !(tags[0] instanceof Array)) ? 
			// NOTE: if we got a single tag return it as a single tag...
			res.pop() 
			: res
	},
	subTags: function(...tags){
		return this.normalize(splitOrList(tags))
			.map(function(tag){
				return tag.split(/[:\\\/]/g) })
			.flat()
			.unique() },

	// Query parser...
	//
	// NOTE: this is loosely based on Slang's parser...
	// 		...see for details: https://github.com/flynx/Slang
	__query_lexer: RegExp([
			/* XXX there are two ways to deal with comments:
			//			1) lexer-based -- this section commented, next uncommented...
			//			2) macro-based -- this section uncommented, next commented...
			//		#2 is a bit buggy...
			// terms to keep in the stream...
			'\\s*('+[
				'\\n',
				'--',
			].join('|')+')',
			//*/

			// lexer comments...
			'\\s*\\(\\*[^\\)]*\\*\\)\\s*',
			'\\s*--.*[\\n$]',
			//*/

			// quoted strings...
			// NOTE: we do not support escaped quotes...
			'\\s*"([^"]*)"\\s*',
			"\\s*'([^']*)'\\s*",

			// quote...
			'\\s*(\\\\)',

			// braces...
			'\([\\[\\]()]\)',

			// whitespace...
			'\\s+',
		].join('|'),
		'm'),
	parseQuery: function(query){
		// lex the input... 
		query = query instanceof Array ? 
			query 
			: query
				// split by strings whitespace and block comments...
				.split(this.__query_lexer || this.constructor.__query_lexer)
				// parse numbers...
				// XXX do we need number parsing???
				.map(function(e){ 
					// numbers...
					if(/^[-+]?[0-9]+\.[0-9]+$/.test(e)){
						e = parseFloat(e)
					} else if(/^[-+]?[0-9]+$/.test(e)){
						e = parseInt(e)
					}
					return e
				})
				// remove undefined groups...
				.filter(function(e){ 
					// NOTE: in JS 0 == '' is true ;)
					return e !== undefined && e !== '' })

		var brace = function(code, b){
			var res = []

			while(code.length > 0){
				var c = code.shift()
				if(c == '[' || c == '('){
					res.push( brace(code, c == '[' ? ']' : ')') )

				} else if(c == b){
					return res

				} else if(c == ']' || c == ')'){
					throw new SyntaxError(`.parseQuery(..): Unexpected "${c}".`)

				} else {
					res.push(c) 
				}
			}

			if(b != null){
				throw new SyntaxError(`.parseQuery(..): Expecting "${b}" got end of query.`)
			}

			return res
		}

		return brace(query)
	},
}


// XXX should we store normalized and non-normalized tags for reference???
// 		...there are two ways to think of this:
// 			1) both (a-la flickr) -- keep both, use normalized internally
// 			2) only normalized -- simpler but may surprise the user and not be as pretty...
var TagsPrototype = {
	config: {
		tagRemovedChars: '[\\s-_]',
	},

	// data...
	//
	// Format:
	// 	Set([ <tag>, ... ])
	//
	// XXX Q: should these be normalized???
	__persistent_tags: null,

	// Format:
	// 	{
	// 		<alias>: <normalized-tag>,
	// 	}
	//
	// XXX need introspection for this...
	// 		...should this be .aliases ???
	__aliases: null,

	// Format:
	// 	{
	// 		<tag>: [ <item>, ... ],
	// 		...
	// 	}
	__index: null,

	// XXX
	// XXX need a way to edit the compound tag...
	__special_tag_handlers__: {
		'*persistent*': function(action, tag, value){
			// XXX remove the tag...
			// XXX add the tag to .__persistent_tags
			// XXX return the new tag for normal handling...
		},
	},
	handleSpecialTag: function(action, tag, value){
		var that = this
		var handlers = this.__special_tag_handlers__ || {}

		// get the matching handler key...
		var key = Object.keys(handlers)
			.filter(function(k){ 
				return that.match(k, tag) })
			// XXX should we handle multiple matches???
			.shift()

		// resolve handler aliases...
		var match = key
		do {
			match = handlers[match]	
		} while(!(match instanceof Function) && match in handlers)

		// no handler...
		if(!(match instanceof Function)){
			// XXX
			return false
		}

		// XXX remove key from tag...

		return match.call(this, action, tag, value)
	},


	// Utils...
	//
	// proxies to class methods...
	normalize: function(...tags){
		return this.constructor.normalize.call(this, ...tags) },
	subTags: function(...tags){
		return this.constructor.subTags.call(this, ...tags) },
	parseQuery: function(query){
		return this.constructor.parseQuery.call(this, query) },


	// Match tags directly...
	//
	// 	Check if tags match...
	// 	.directMatch(tag, tag)
	// 		-> bool
	//
	// 	Get all matching tags...
	// 	.directMatch(tag)
	// 		-> tags
	//
	// 	Filter out non-matching from tags...
	// 	.directMatch(tag, tags)
	// 		-> tags
	//
	//
	// Query syntax:
	// 	a		- tag
	// 	a/b		- path, defines a directional relation between a and b
	// 	a:b		- set, defines a non-directional relation between a and b
	// 	*		- tag placeholder, matches one and only one tag name
	//
	// NOTE: a tag is also a singular path and a singular set.
	// NOTE: paths have priority over sets: a/b:c -> a / b:c
	// NOTE: there is a special case pattern '*a*' that matches the same 
	// 		way as 'a', this is used in cases where 'a' is used as an 
	// 		explicit match (see: .untag(..))
	//
	//
	// Two paths match iff:
	// 	- all of the components of the first are contained in the second and
	// 	- component order is maintained.
	//
	// Example:
	// 		path		match		no match
	// 		--------------------------------
	// 		a			a			z
	// 					a/b			b/c
	// 					x/a/y		...
	// 					x/a
	// 					...
	// 		--------------------------------
	// 		a/b			a/b			b/a
	// 					x/a/y/b/z	b/x
	// 					...			...
	//
	//
	// Two sets match iff:
	// 	- all of the components of the first are contained in the second.
	//
	// Example:
	// 		set			match		no match
	// 		--------------------------------
	// 		a			a			z
	// 					a:b			b:c
	// 					x:a			...
	// 					x:a:z
	// 					...
	// 		--------------------------------
	// 		a:b			a:b			a:x
	// 					b:c			z:b:m
	// 					a:x:b		...
	// 					...
	//
	//
	// NOTE: this is not symmetric e.g. a will match a:b but not vice-versa.
	// NOTE: this does not try to match outside the scope of the actual 
	// 		given tags, to search taking paths into account use .match(..)
	directMatch: function(a, b, cmp){
		var that = this

		if(b instanceof Function){
			cmp = b
			b = null
		}

		// get matching tags...
		if(b == null || b instanceof Array){
			return (b || this.tags())
				.filter(function(tag){ 
					return that.directMatch(a, tag, cmp)})

		// match two tags...
		} else {
			// normalized match...
			a = this.normalize(a)
			b = this.normalize(b)

			// special case: *tag* pattern...
			a = /^\*[^:\\\/]*\*$/.test(a) ? 
				a.slice(1, -1) 
				: a

			if(a == b){
				return true
			}

			// set matching...
			// 	a matches b iff each element of a exists in b.
			var matchSet = function(a, b){
				a = a.split(/:/g) 
				b = b.split(/:/g)
				return a.length <= b.length
					&& a.filter(function(e){ 
						return e != '*' 
							&& b.indexOf(e) < 0
				   			&& !(cmp 
								&& b.filter(cmp.bind(null, e)).length > 0) })
						.length == 0 }

			// path matching...
			// 	a matches b iff each element in a exists in b and in the same 
			// 	order as in a.
			//
			// NOTE: we do not need to use cmp(..) here as we are testing 
			// 		tag compatibility deeper in matchSet(..)...
			var sa = a.split(/[\/\\]/g) 
			var sb = b.split(/[\/\\]/g)
			return sb
					.reduce(function(a, e){
						return (a[0] 
								&& (a[0] == '*' 
									|| matchSet(a[0], e))) ? 
							a.slice(1) 
							: a
					}, sa)
					.length == 0
		}
	},

	// Match tags directly or indirectly...
	//
	// This is the same as .directMatch(..) but also uses paths to check
	// tag "reachability"...
	//
	// Matching rule:
	// 	a and b match iff both a and b are reachable on a single path 
	// 	where a is above b.
	//
	//
	// Example:
	// 		ts.togglePersistent('a/b/c', 'a/x/y', 'c/d/e')
	//
	// 		// see if 'a' directly matches 'c'...
	// 		ts.directMatch('a', 'c')	// -> false
	//
	// 		// indirect matches... 
	// 		ts.match('a', 'c')			// -> true
	// 		ts.match('a', 'y')			// -> true
	// 		// indirect extended match... 
	// 		ts.match('a', 'e')			// -> true
	//
	// 		// two different paths...
	// 		ts.match('c', 'y')			// -> false
	// 		// path search is directional...
	// 		ts.match('c', 'a')			// -> false
	//
	//
	match: function(a, b, cmp){
		var that = this

		var res = this.directMatch(...arguments) 

		// get paths with tag...
		var paths = function(tag){
			return that.directMatch(tag, cmp)
				.filter(function(t){ 
					return /[\\\/]/.test(t) }) }

		// search the path tree...
		// NOTE: this will stop the search on first hit...
		var search = function(tag, seen){
			seen = seen || new Set()
			return paths(tag)
				.reduce(function(res, path){
					if(res == true){
						return res
					}

					path = path.split(/[\\\/]/g) 
					// restrict direction...
					path = path.slice(0, path.indexOf(tag))

					// check current set of reachable tags...
					return (that.directMatch(a, path, cmp).length != 0)
						|| path
							// search next level...
							.reduce(function(res, tag){
								return res ? 
										res
									: seen.has(tag) ?
										false
									: search(tag, seen.add(tag)) }, false) }, false) }

		return res === false ?
			search(b)
			: res 
	},

	// Search tags...
	//
	// 	Search the tags...
	// 	.search(str)
	// 		-> matches
	//
	// 	Search the given list...
	// 	.search(str, tag)
	// 	.search(str, [tag, ..])
	// 		-> matches
	//
	//
	// This is almost the same as .match(..) but each tag is treated as 
	// a regexp...
	// The rest of the tag set/path matching rules apply as-is.
	//
	//
	// Signature differences between this and .match(..):
	// 	1) .match(..) can return a bool:
	// 			.match(tag, tag)
	// 				-> bool
	//
	// 		while in the same conditions .search(..) will return a list:
	// 			.search(tag, tag)
	// 				-> list
	//
	// 		where list is empty list if not match was found.
	//
	// 	2) .search(..) will return individual matching tags:
	// 			// setup a trivial example...
	// 			var t = new Tags()
	// 				.tag('a:b:c', 'x')
	//
	// 			// returns only the actual used tags...
	// 			t.match('a')	// -> ['a:b:c']
	//
	// 			// also returns individual tag matches...
	// 			t.search('a')	// -> ['a:b:c', 'a']
	//
	// 		NOTE: .search(..) will not build up all the possible matches
	// 			(i.e. ['a:b:c', 'a:b', 'a:c', 'a']) and will only return
	// 			the actual full match and an individual tag match...
	// 			XXX should it???
	search: function(query, tags){
		var that = this
	   	tags = tags == null ?
				this.tags()
			: tags instanceof Array ?
				tags
			: [tags]

		// build the search...
		var index = new Map()
		var cmp = function(a, b){
			index.has(a)
				|| index.set(a, new RegExp(a))
			return index.get(a).test(b) }

		return tags
			// split tags + include original list...
			.run(function(){
				return this
					.concat(that.subTags(this)) 
					.unique() })
			.filter(function(t){
				// XXX should this search up the path???
				//return that.directMatch(query, t, cmp) }) },
				return that.match(query, t, cmp) }) },


	// Introspection...
	//
	get length(){
		return this.values().length },

	// XXX can these be faster???
	// XXX should these take multiple values???
	hasTag: function(tag){
		for(var t of this.tags()){
			if(this.match(tag, t)){
				return true
			}
		}
		return false
	},
	has: function(value){
		for(var v of Object.values(this.__index || {})){
			if(v.has(value)){
				return true
			}
		}
		return false
	},



	// Tags present in the system...
	//
	//	Get all tags...
	//	.tags()
	//		-> tags
	//
	//	Get value tags...
	//	.tags(value)
	//		-> tags
	//
	//	Check value tags...
	//	.tags(value, tag)
	//	.tags(value, tag, ..)
	//	.tags(value, [tag, ..])
	//		-> bool
	//
	//
	// NOTE: this includes all the .persistent tags as well as all the 
	// 		tags actually used.
	//
	// XXX should this return split values???
	// 		i.e. 'red:car' -> ['red', 'car']
	tags: function(value, ...tags){
		var that = this

		// check if value is tagged by tags..,
		if(value && tags.length > 0){
			tags = splitOrList(tags)
			var u = this.tags(value)
			while(tags.length > 0){
				if(this.match(tags.shift(), u).length == 0){
					return false
				}
			}
			return true

		// get tags of specific value...
		} else if(value){
			return Object.entries(this.__index || {})
				.filter(function(e){ return e[1].has(value) })
				.map(function(e){ return e[0] })
				.flat()
				.unique()

		// get all tags...
		} else {
			return Object.keys(this.__index || {})
				.concat([...(this.__persistent_tags || [])]
					.map(function(t){ 
						return that.normalize(t) }))
				.unique()
		}
	},
	// Same as .tags(..) but returns a list of single tags...
	// XXX should we combine this with .tags(..) ???
	singleTags: function(value, ...tags){
		return this.subTags(this.tags(...arguments)).unique() },
	// XXX should this support ...tags???
	// XXX should this expand paths???
	// 		...i.e. show all the paths a value participates in...
	paths: function(value){
		return this.tags(value)
			.filter(function(tag){ return /[\\\/]/.test(tag) }) },
	// XXX should this support ...tags???
	sets: function(value){
		return this.tags(value)
			.filter(function(tag){ return tag.includes(':') }) },
	//
	// 	Get all values...
	// 	.values()
	// 		-> values
	//
	// 	Get specific tag values...
	// 	.values(tag)
	// 		-> values
	//
	// NOTE: this does not support any query syntax...
	values: function(tag){
		var that = this
		tag = this.normalize(tag || '*')
		return [...new Set(
			Object.entries(this.__index || {})
				.filter(function(e){ 
					return tag == '*' 
						|| that.match(tag, e[0]) })
				.map(function(s){ return [...s[1]] })
				.flat())] },


	// Add/Remove/Modify tags API...
	// 
	// 	Resolve alias (recursive)...
	// 	.alias(tag)
	// 		-> value
	// 		-> undefined
	//
	// 	Set alias...
	// 	.alias(tag, value)
	// 		-> this
	//
	// 	Remove alias...
	// 	.alias(tag, null)
	// 		-> this
	//
	alias: function(tag, value){
		var aliases = this.__aliases = this.__aliases || {}
		// XXX this seems a bit ugly...
		var resolve = function(tag, seen){
			seen = seen || []
			// check for loops...
			if(seen.indexOf(tag) >= 0){
				throw new Error(`.alias(..): Recursive alias chain: "${ 
					seen
						.concat([seen[0]])
						.join('" -> "') }"`) }
			var next = aliases[tag] 
				|| aliases[this.normalize(tag)]
			seen.push(tag)
			return next != null ?
					resolve(next, seen)
				: seen.length > 1 ? 
					tag
				: undefined
		}.bind(this)

		// resolve...
		if(arguments.length == 1){
			return resolve(tag.trim())

		// remove...
		} else if(value == null){
			delete aliases[tag.trim()]
			delete aliases[this.normalize(tag)]

		// set...
		} else {
			tag = tag.trim()
			value = this.normalize(value)

			// check for recursion...
			var chain = []
			var target = resolve(value, chain)
			if(target == tag || target == this.normalize(tag)){
				throw new Error(`.alias(..): Creating a recursive alias chain: "${ 
					chain
						.concat([chain[0]])
						.join('" -> "') }"`) }

			aliases[tag] = value
		}
		return this
	},
	// XXX save un-normalized tags as aliases... ???
	// XXX when value is not given, add tags to persistent tags...
	tag: function(tags, value){
		var that = this
		value = value instanceof Array ? value : [value]
		tags = this.normalize(tags instanceof Array ? tags : [tags])
		var index = this.__index = this.__index || {}

		value.forEach(function(value){
			tags
				.forEach(function(tag){
					(index[tag] = index[tag] || new Set()).add(value) }) })

		return this
	},
	// NOTE: this supports tag patterns (see: ,match(..))
	// NOTE: non-pattern tags are matched explicitly.
	untag: function(tags, value){
		var that = this
		var index = this.__index = this.__index || {}

		value = value instanceof Array ? value : [value]
		tags = this.normalize(tags instanceof Array ? tags : [tags])
			.map(function(tag){
				return /\*/.test(tag) ? 
					// resolve tag patterns...
					that.match(tag) 
					: tag })
			.flat()

		value.forEach(function(value){
			tags
				.forEach(function(tag){
					var s = index[tag] || new Set()
					s.delete(value) 
					// remove empty sets...
					if(s.size == 0){
						delete index[tag]
					}
				}) })

		return this
	},
	//
	//	Toggle tag for each values...
	//	.toggle(tag, value)
	//	.toggle(tag, values)
	//		-> [bool|null, ..]
	//		NOTE: if tag is a tag pattern (contains '*') this will toggle
	//			matching tags values off as expected but ignore toggling 
	//			tags on in which case null will be  returned for the 
	//			corresponding position.
	//
	//	Toggle tag on for all values...
	//	.toggle(tag, value, 'on')
	//	.toggle(tag, values, 'on')
	//		-> this
	//		NOTE: this will throw an exception if tag is a tag pattern,
	//			this is not symmetrical to how .toggle(.., .., 'off')
	//			behaves.
	//
	//	Toggle tag off for all values...
	//	.toggle(tag, value, 'off')
	//	.toggle(tag, values, 'off')
	//		-> this
	//		NOTE: if tag is a tag pattern this will remove all matching 
	//			tags, this is not fully symmetrical to .toggle(.., .., 'on')
	//
	//	Check if tag is set on value(s)...
	//	.toggle(tag, value, '?')
	//	.toggle(tag, values, '?')
	//		-> [bool, ..]
	//
	//
	// NOTE: this supports tag patterns (see: ,match(..))
	//
	// XXX do we need this???
	// 		...seems a bit overcomplicated...
	toggle: function(tag, values, action){
		var that = this
		values = values instanceof Array ? values : [values]
		var pattern = /\*/.test(tag)
		var ntag = this.normalize(tag)

		// can't set pattern as tag...
		if(pattern && action != 'on'){
			throw new TypeError(`.toggle(..): will not toggle on "${tag}": pattern and not a tag.`)
		}

		return action == 'on' ?
				this.tag(tag, values)
			: action == 'off' ?
				this.untag(tag, values)
			: action == '?' ?
				values
					.map(function(v){ 
						return pattern ? 
							// non-strict pattern search...
							that.tags(v, tag) 
							// strict test...
							: that.tags(v).indexOf(ntag) >= 0 })
			// toggle each...
			: values
				.map(function(v){ 
					return that.tags(v, tag) ? 
						(that.untag(tag, v), false) 
						// NOTE: we set only if we are not a pattern...
						: (!pattern ? 
							(that.tag(tag, v), true) 
							: null) }) },

	// Toggle a tag to persistent/non-persistent...
	//
	// A persistent is not removed when untagging a value.
	//
	//	.togglePersistent(tag)
	//	.togglePersistent(tag, tag, ...)
	//	.togglePersistent([tag, tag, ...])
	//		-> states
	//
	//	.togglePersistent(tag, action)
	//	.togglePersistent(tag, tag, ..., action)
	//	.togglePersistent([tag, tag, ...], action)
	//		-> states
	//
	//
	// action can be:
	// 	'on'		- toggle all tags on
	// 	'off'		- toggle all off
	// 	'toggle'	- toggle all depending on initial state
	// 	'?'			- return list of states
	//
	//
	// XXX one way to play with this is to add a special tag to set/path
	// 		to make it persistent...
	// 		Example:
	// 			.tag('abc', ...)	-> 'abc' is a normal tag...
	//
	// 			.tag('persistent:abc', ...)	-> 'abc' is persistent...
	// 			.tag('persistent/abc', ...)	-> 'abc' is persistent...
	//
	// 		We would need "virtual" tags for this, i.e. tags that are 
	// 		not actually added to the index but are used for system 
	// 		stuff...
	togglePersistent: function(...tags){
		action = ['on', 'off', 'toggle', '?'].includes(tags[tags.length-1]) ?
			tags.pop()
			: 'toggle'
		tags = splitOrList(tags)

		var persistent = 
			this.__persistent_tags = 
				this.__persistent_tags || new Set()

		return this.normalize(tags)
			.map(function(tag){
				return action == 'on' ?
						(persistent.add(tag), 'on')
					: action == 'off' ?
						(persistent.delete(tag), 'off')
					: action == 'toggle' ?
						(persistent.has(tag) ?
							(persistent.delete(tag), 'off')
							: (persistent.add(tag), 'on'))
					: (persistent.has(tag) ?
						'on' 
						: 'off') })
	},

	// Rename a tag...
	//
	// 	Rename tag...
	// 	.rename(from, to)
	// 		-> this
	//
	// 	Rename a tag in list of tags...
	// 	.rename(from, to, tag, ...)
	// 	.rename(from, to, [tag, ...])
	// 		-> tags
	//
	// NOTE: if to is '' this will remove all occurrences of from.
	// NOTE: if any renamed tag is renamed to '' it will be removed 
	// 		untagging all relevant values...
	//
	// XXX need to sanitize from -- it can not contain regex characters...
	// 		...should we guard against this???
	// XXX should both sides of the alias be renamed???
	rename: function(tag, to, ...tags){
		var that = this

		tag = this.normalize(tag)
		if(tag == ''){
			throw new Error(`.rename(..): first argument can not be an empty string.`) }
		if(/[:\\\/]/.test(tag)){
			throw new Error(
				`.rename(..): only support singular tag renaming, got: "${tag}"`) }
		// XXX too strict???
		if(!/^[a-z0-9]+$/.test(tag)){
			throw new Error(
				`.rename(..): first argument must be a valid single tag, got: "${tag}"`) }

		to = this.normalize(to)
		if(/[\\\/]/.test(to)){
			throw new Error(
				`.rename(..): only support tags and tag sets as renaming target, got: "${to}"`) }

		tags = new Set(splitOrList(tags))

		// prepare for the replacement...
		var pattern = new RegExp(`(^|[:\\\\\\/])${tag}(?=$|[:\\\\\\/])`, 'g')
		var target = `$1${to}` 

		var patchSet = function(s){
			that.match(tag, [...s || []])
				.forEach(function(tag){
					s.delete(tag)
					var t = that.normalize(tag.replace(pattern, target))
					t != ''
						&& s.add(t)
				}) 
			return s 
		}
		var patchObj = function(o, patchValue){
			that.match(tag, Object.keys(o || {}))
				.forEach(function(m){
					var value = o[m]
					delete o[m]
					var t = that.normalize(m.replace(pattern, target))
					t != ''
						&& (o[t] = value)
				}) 
			patchValue 
				&& Object.keys(o || {})
					.forEach(function(m){
						var v = o[m]
						if(that.match(tag, v)){
							var t = that.normalize(v.replace(pattern, target))
							t == '' ?
								(delete o[m])
								: (o[m] = t)
						}
					})
			return o 
		}

		// rename tags in list...
		if(arguments.length > 2){
			return [...patchSet(tags)]

		// rename actual data...
		} else {
			patchSet(this.__persistent_tags || [])
			patchObj(this.__index || {})
			patchObj(this.__aliases || {}, true)
		}
		
		return this
	},

	// NOTE: this is a short hand to .rename(tag, '', ..) for extra 
	// 		docs see that...
	removeTag: function(tag, ...tags){
		return this.rename(tag, '', ...tags) },

	// Remove the given values...
	//
	// 	.remove(value, ..)
	// 	.remove([value, ..])
	// 		-> this
	//
	remove: function(...values){
		values = splitOrList(values)
		var res = this.clone()

		Object.entries(res.__index || {})
			.forEach(function(e){
				res.__index[e[0]] = e[1].subtract(values) })

		return res
	},

	// Keep only the given values...
	//
	// 	.keep(value, ..)
	// 	.keep([value, ..])
	// 		-> this
	//
	keep: function(...values){
		values = splitOrList(values)
		var res = this.clone()

		Object.entries(res.__index || {})
			.forEach(function(e){
				res.__index[e[0]] = e[1].intersect(values) })

		return res
	},

	// Join 1 or more Tags objects...
	//
	//	.join(other, ..)
	//	.join([other, ..])
	//		-> this
	//
	join: function(...others){
		var that = this
		var index = this.__index || {}
		splitOrList(others)
			.forEach(function(other){
				Object.entries(other.__index || {})
					.forEach(function(e){
						index[e[0]] = new Set([...(index[e[0]] || []), ...e[1]]) }) })
		Object.keys(index).length > 0 
			&& this.__index == null
			&& (this.__index = index)
		return this
	},



	// Query API...
	//
	//
	// The language (String):
	// 	<query> ::= <tag> 
	// 		| <call> 
	// 		| <list>
	// 	<query> ::= <query> ..
	//
	// 	<tag> ::= string
	//
	// 	<call> ::= (<function-name>)
	// 		| (<function-name> <query> .. )
	//
	// 	<list> ::= ()
	// 		| (<query> .. )
	//
	//
	// NOTE: all lists are treated as sets in that any item can be present 
	// 		only once and all duplicates are discarded.
	//
	//
	//
	// Execution model:
	// 	Pre-processor stage
	// 		Executes before the main stage and produces code to be run 
	// 		on the main stage.
	// 	Main stage
	// 		Executes after the pre-processor and produces a list of values.
	//
	//
	//
	// The language supports three types of "functions":
	// 	Pre-processor function
	// 		this is processed prior to query execution and generates valid 
	// 		code to be executed on the next stage
	// 	Function (normal)
	// 		gets a list of resolved arguments and resolves to a list
	// 	Special form
	// 		gets a list of unresolved arguments (as-is) and resolves to a list
	//
	//
	//
	// Value resolution:
	// 	tag		-> resolves to list of matching values as returned by .values(tag)
	// 	list	-> resolved to list of resolved items
	// 	call	-> resolves to list of values returned by the called function
	//
	//
	// Quoting:
	// 	`a
	// 		will resolve to a literal 'a'
	// 		NOTE: this is not the same as (values a) because (values ..)
	// 			returns a list while quoting will place the value as-is
	//
	//
	// Expansion:
	// 	^( .. )
	// 		will expand the contents to the containing list
	//
	// 		Example:
	// 			(a b ^(c d) c e)
	// 				-> (a b c d e)
	//
	// 		NOTE: that the repeating value 'c' is discarded.
	// 		NOTE: @( .. ) can be used to expand values at the pre-processor
	// 				stage.
	//
	//
	//
	// Pre-processor function:
	// 	(search ..)
	// 		resolves to an (or ..) call passed a list of tags matching 
	// 		the arguments.
	//
	// 		Shorthand:
	// 			`a` -> (search a)
	//
	//
	//
	// Functions:
	// 	(and ..)
	// 		resolves to the list of values present in each of the arguments
	//
	// 	(or ..)
	// 		resolves to the list of all the values of all the arguments
	//
	// 	(not a ..)
	// 		resolves to list of values in a not present in any of the 
	// 		other arguments
	// 
	//
	//
	// Special forms:
	// 	(values ..)
	// 		resolves to the list of values as-is.
	// 		this makes it possible to pass in a set of values as-is 
	// 		without resolving them as tags.
	//
	// 		Shorthand:
	// 			(`a `b `c)
	// 				-> (values a b c)
	//
	// 		NOTE: the braces in the shorthand, (values ..) always produces 
	// 			a list while quoting a value is always a single value.
	//
	//
	//
	// Testing queries:
	// 	(values ..) adds the ability to test queries independently of 
	// 	the actual content of the Tags object by passing in explicit 
	// 	values...
	//
	// 	Example:
	// 		.query(`
	// 			(and 
	// 				(values a b c), 
	// 				(values b c d))`)
	// 			-> ['b', 'c']
	//
	//
	//
	// The language AST:
	// 	<query> ::= <tag> 
	// 		| <call> 
	// 		| <list>
	// 	<query> ::= [ <query>, .. ] 
	//
	// 	<tag> ::= string
	//
	// 	<call> ::= [ <function-name> ]
	// 		| [ <function-name>, <query>, .. ]
	//
	// 	<list> ::= []
	// 		| [ <query>, .. ]
	//
	//
	// NOTE: the AST can be used as a query format as-is, this will 
	// 		avoid the parse stage...
	//
	//
	// XXX would be nice to have access to the forming argument list to 
	// 		be able to expand list (a-la ...list in JS)
	// XXX not sure about the .flat(1) calls...
	__query_ns_pre: {
		search: function(...args){
			return ['or',
				...args
					.map(function(t){ 
						return this.search(t) }.bind(this))
					.flat()
					.unique() ] },
	},
	__query_ns: {
		and: function(...args){
			// NOTE: we are sorting the lists here to start with the 
			// 		largest and smallest lists (head/tail) to drop the 
			// 		majority of the values the earliest and speed things 
			// 		up...
			args = args
				.sort(function(a, b){ return a.length - b.length })
			var t = args.pop()
			t = t instanceof Array ? t : [t]
			return [...args
				.reduce(function(res, l){
						return res
							.intersect(l instanceof Array ? 
								l.flat(1) 
								: [l]) }, 
					new Set(t))] },
		or: function(...args){
			return [...new Set(args.flat(1))] },
		not: function(...args){
			return [...new Set(args.shift() || [])
				.subtract(args.flat())] },

		flat: function(...args){ return args.flat() },
	},
	__query_ns_special: {
		values: function(...args){ return args },
	},
	//
	//	Execute query...
	//	.query(query)
	//		-> values
	//
	//	Execute the query and return raw/structured results...
	//	.query(query, true)
	//		-> values
	//
	// XXX do we need expand(..) ???
	query: function(query, raw){
		var that = this
		var pre = this.__query_ns_pre
		var ns = this.__query_ns
		var sns = this.__query_ns_special

		var expand = function(prefix, list){
			return prefix == null ?
				list
				: list
					.reduce(function(res, e){
						return res[res.length-1] == prefix ?
							res.slice(0, -1).concat(e instanceof Array ? e : [e])
							: res.concat([e]) }, [])
					.filter(function(e){
						return e != prefix }) }

		// Query Language pre-processor...
		var PreQL = function(args){
			return (
				// function -> query args and call...
				args[0] in pre ?
					pre[args[0]].call(that, ...expand('@', PreQL(args.slice(1))))
				// list of tags -> query each arg...
				: args
					.map(function(arg){
						return arg instanceof Array ?
								PreQL(arg)
							// search shorthand...
							: arg.startsWith('`') && arg.endsWith('`') ?
								PreQL(['search', arg.slice(1, -1)])
							: arg }) ) }

		// Query Language Executor...
		var QL = function(args){
			return (
				// function -> query args and call...
				args[0] in ns ?
					ns[args[0]].call(that, ...expand('^', QL(args.slice(1))))
				// special form -> pass args as-is...
				: args[0] in sns ?
					sns[args[0]].call(that, ...expand('^', args.slice(1)))
				// list of tags -> query each arg...
				: args
					.map(function(arg){
						return arg instanceof Array ?
								QL(arg)
							// quoting...
							: arg.startsWith('`') ?
								arg.slice(1)
							: that.values(arg) }) ) }

		return QL(PreQL(query instanceof Array ? 
				query 
				: this.parseQuery(query) ))
			.run(function(){
				return raw ?
					this
					// normalize results by default...
					: (this
						.flat()
						.unique()) })
	},


	// Object utility API...
	//
	// 	.clone()
	// 	.clone('full')
	// 		-> tags
	//
	// 	.clone('tags')
	// 		-> tags
	//
	clone: function(mode){
		return new this.constructor(this.json(mode)) },

	// Serialization...
	//
	// 	.json()
	// 		-> json
	//
	//
	// Format:
	// 	{
	// 		// optional
	// 		aliases: null | {
	// 			<alias>: <value>,	
	// 			...
	// 		},
	//
	// 		// optional
	// 		persistent: null | [ <tag>, .. ],
	//
	// 		tags: {
	// 			<tag>, [ <value>, .. ],
	// 			...
	// 		},
	// 	}
	//
	//
	// NOTE: to get the current tags use .tags()
	//
	// XXX should this serialize recursively down???
	// 		...it might be a good idea to decide on a serialization 
	// 		protocol and use it throughout...
	json: function(){
		var res = {}

		// aliases...
		this.__aliases && Object.keys(this.__aliases).length > 0
			&& (res.aliases = Object.assign({}, this.__aliases))

		// persistent tags...
		this.__persistent_tags && this.__persistent_tags.size > 0
			&& (res.persistent = [...this.__persistent_tags])

		// tags...
		res.tags = {}
		Object.entries(this.__index || {})
			.forEach(function(e){
				// XXX should we serialize the items here???
				res.tags[e[0]] = [...e[1]] })

		return res
	},
	load: function(json){
		var that = this

		// aliases...
		json.aliases
			&& (this.__aliases = Object.assign({}, json.aliases))

		// persistent tags...
		json.persistent
			&& (this.__persistent_tags = new Set(json.persistent))

		// tags...
		json.tags
			&& (this.__index = {})
			&& Object.entries(json.tags)
				.forEach(function(e){
					that.__index[e[0]] = new Set(e[1]) })

		return this
	},

	__init__: function(json){
		json 
			&& this.load(json) },
}


var Tags = 
module.Tags = 
object.makeConstructor('Tags', 
		TagsClassPrototype, 
		TagsPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
