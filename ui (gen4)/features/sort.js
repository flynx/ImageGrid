/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')

var core = require('features/core')
var widgets = require('features/ui-widgets')

var overlay = require('lib/widget/overlay')
var browse = require('lib/widget/browse')



/*********************************************************************/

// XXX add sorting on load....
// XXX save sort cache??? 
// XXX should this be split into edit/view???
var SortActions = 
module.SortActions = actions.Actions({
	config: {
		// Default sort method...
		//
		// this can be:
		// 	- sort mode name		- as set in .config['sort-mode'] key
		// 								Example: 'Date'
		// 	- explicit sort method	- as set in .config['sort-mode'] value
		// 								Example: 'metadata.createDate birthtime ctime'
		'default-sort': 'Date',

		// Default sort order...
		//
		// can be: 'default', 'reverse')
		'default-sort-order': 'default',
		
		// Sort methods...
		//
		// Format:
		// 	The value is a space separated string of methods.
		// 	A method is either a sort method defined in .__sort_methods__
		// 	or a dot-separated image attribute path.
		//
		// NOTE: 'Date' is descending by default
		// NOTE: .toggleImageSort('?') may also show 'Manual' when 
		// 		.data.manual_order is present.
		// NOTE: 'Manual' mode is set after .shiftImageLeft(..)/.shiftImageRight(..)
		// 		are called or when restoring a pre-existing .data.manual_order 
		// 		via .toggleImageSort('Manual')
		// NOTE: all sort methods are terminated with 'keep-position' so 
		// 		as to prevent shuffling of images that are not usable with
		// 		the previous methods in chain...
		'sort-methods': {
			'none': '',
			// NOTE: for when date resolution is not good enough this 
			// 		also takes into account file sequence number...
			// NOTE: this is descending by default...
			// NOTE: if a method starts with a lower case letter it is 
			// 		considered an alias and will be hidden from the UI...
			'Date': 
				'image-date name-sequence reverse',
			'File date': 
				'file-date reverse',
			'File sequence number (with overflow)': 
				'name-sequence-overflow name path',
			'File sequence number': 
				'name-sequence name path',
			'Name': 
				'name path',
			'Name (natural number order)': 
				'name-leading-sequence name path',

			// aliases...
			'example-sort-alias':
				'Date "File date" Name',
		},
	},

	toggleDefaultSortOrder: ['- Edit|Sort/Default sort order',
		core.makeConfigToggler('default-sort-order', ['default', 'reverse'])],

	// XXX de we need this to be recursive???
	// 		...or do we need a recursive expansion action???
	expandSortMethod: ['- Sort/',
		core.doc`Expand sort method...

			Expand all methods...
			.expandSortMethod()
				-> methods

			Expand one specific method...
			.expandSortMethod(method)
				-> [method, ..]
				-> null

			Expand specific methods...
			.expandSortMethod(method, method, ..)
			.expandSortMethod([method, method, ..])
				-> methods

		methods format:
			{
				<method-name>: [method, ...],
				...
			}

		NOTE: this is non-recursive...
		`,
		function(...methods){
			var that = this
			// normalize args...
			methods = methods.length == 0 ?
					Object.keys(this.config['sort-methods'] || {})
				: methods.length == 1 ?
					methods.pop()
				: methods

			var splitMethods = function(m){
				return (m instanceof Array ? 
							m 
						: typeof(m) == typeof('str') ?
							m
								.split(/'([^']*)'|"([^"]*)"| +/)
								.filter(function(e){ 
									return e && e.trim() != '' && !/['"]/.test(e) }) 
						: [])
					.reduce(function(r, e){
						return r.concat(e instanceof Array ? e : [e]) }, []) }
			var get = function(name){
				// normalize name...
				name = name
					.trim()
					// remove quotes...
					.replace(/^(["'])([^'"]*)(\1)$/, '$2')
				var m = that.config['sort-methods'][name]
					|| (that.__sort_methods__ && that.__sort_methods__[name])
					|| SortActions.__sort_methods__[name]
				return typeof(m) == typeof('str') ? splitMethods(m) : m
			}

			// return a single method...
			if(!(methods instanceof Array)){
				return actions.ASIS(get(methods) || null)
			}

			// return multiple methods...
			var res = {}
			methods
				.forEach(function(m){ res[m] = get(m) })
			return res
		}],

	// Custom sort methods...
	//
	// Format:
	// 	{
	// 		<method-name>: function(){
	// 			...
	// 			return function(a, b){ ... }
	// 		},
	// 		...
	// 	}
	//
	// The methods are cmp constructors rather than direct cmp functions
	// to enable index construction and other more complicated sort 
	// approaches...
	//
	// NOTE: the cmp function is called in the actions context.
	//
	// XXX add progress...
	// XXX add doc support -- make this an action-set???...
	// XXX add alias and string support...
	__sort_methods__: {
		// aliases...
		'image-date':
			'image-create-date',
		'file-date':
			'file-create-date',
		// XXX
		//'modify-date':
		//	'image-modify-date',

		'image-create-date':
			'metadata.createDate file-date name-sequence',
		// XXX 
		//'image-modify-date':
		//	'metadata.createDate birthtime ctime name-sequence',
		
		'file-create-date':
				'birthtime ctime',


		// XXX make sequence sort methods compatible with repeating numbers,
		// 		i.e. for file names like DSC_1234 sorting more than 10K files
		// 		should split the repeating numbers by some other means, like
		// 		date...
		// NOTE: these will not sort items that have no seq in name...
		'name-leading-sequence': function(){
			return function(a, b){
				a = this.images.getImageNameLeadingSeq(a)
				a = typeof(a) == typeof('str') ? 0 : a
				b = this.images.getImageNameLeadingSeq(b)
				b = typeof(b) == typeof('str') ? 0 : b

				return a - b
			}
		},
		'name-sequence': function(){
			return function(a, b){
				a = this.images.getImageNameSeq(a)
				a = typeof(a) == typeof('str') ? 0 : a
				b = this.images.getImageNameSeq(b)
				b = typeof(b) == typeof('str') ? 0 : b

				return a - b
			}
		},
		// NOTE: this will actually sort twice, stage one build sort index and
		// 		second stage is a O(n) lookup cmp...
		// 		XXX not sure if this is the best way to go...
		'name-sequence-overflow': function(){
			var that = this

			// gap and gap length...
			var gap = -1
			var l = 1

			// XXX add progress reporting...
			var lst = this.images
				.map(function(gid){ 
					return [gid, that.images.getImageNameSeq(gid)] })
				// keep only items with actual sequence numbers...
				.filter(function(e){
					return typeof(e[1]) == typeof(123) })
				// sort by sequence...
				.sort(function(a, b){ 
					a = a[1]
					a = typeof(a) == typeof('str') ? 0 : a
					b = b[1]
					b = typeof(b) == typeof('str') ? 0 : b

					return a - b 
				})
				// find largest gaps...
				.map(function(e, i, lst){
					var c = (lst[i+1] || e)[1] - e[1]
					if(c > l){
						l = c
						gap = i
					}
					return e
				})

			// rotate index blocks...
			if(l > 1){
				var tail = lst.splice(gap+1, lst.length)
				lst = tail.concat(lst)
			}

			// build the actual lookup table...
			var index = {}
			lst.forEach(function(e, i){
				index[e[0]] = i
			})

			// return the lookup cmp...
			return function(a, b){
				// XXX is 0 as alternative here the correct way to go???
				return (index[a] || 0) - (index[b] || 0) }
		},

		// This is specifically designed to terminate sort methods to prevent
		// images that are not relevant to the previous order to stay in place
		//
		// XXX need to test how will this affect a set of images where part
		// 		of the set is sortable an part is not...
		// XXX legacy: this is added to every sort automatically...
		// 		...do we still need this here???
		'keep-position': function(){
			return function(a, b){
				a = this.data.order.indexOf(a)
				b = this.data.order.indexOf(b)

				return a - b
			}
		},
	},
	// Sort images...
	//
	//	Sort using the default sort method
	//	.sortImages()
	//		NOTE: the actual sort method used is set via 
	//			.config['default-sort'] and .config['default-sort-order']
	//
	//	Sort using a specific method(s):
	//	.sortImages(<method>)
	//	.sortImages(<method>, <reverse>)
	//
	//	.sortImages('<method> ..')
	//	.sortImages('<method> ..', <reverse>)
	//
	//	.sortImages([<method>, ..])
	//	.sortImages([<method>, ..], <reverse>)
	//		NOTE: <method> can either be one of:
	//			1) method name (key) from .config['sort-methods']
	//			2) a space separated string of methods or attribute paths
	//				as in .config['sort-methods']'s values.
	//			for more info se doc for: .config['sort-methods']
	//		NOTE: if it is needed to reverse the method by default just
	//			add 'reverse' to it's string.
	//
	//	Update current sort order:
	//	.sortImages('update')
	//		NOTE: unless the sort order (.data.order) is changed manually
	//			this will have no effect.
	//		NOTE: this is designed to facilitate manual sorting of 
	//			.data.order
	//
	//	Reverse image order:
	//	.sortImages('reverse')
	//
	//
	// NOTE: if a sort method name contains a space it must be quoted either
	// 		in '"'s or in "'"s.
	// NOTE: reverse is calculated by oddity -- if an odd number indicated
	// 		then the result is reversed, otherwise it is not. 
	// 		e.g. adding:
	// 		 	'metadata.createDate birthtime ctime' + ' reverse' 
	// 		will reverse the result's order while:
	// 		 	'metadata.createDate birthtime ctime reverse' + ' reverese' 
	// 		will cancel reversal.
	// NOTE: with empty images this will not do anything.
	//
	// XXX would be nice to be able to sort a list of gids or a section
	// 		of images...
	// XXX should this handle manual sort order???
	sortImages: ['- Edit|Sort/Sort images',
		function(method, reverse){ 
			var that = this

			if(method == 'reverse'){
				method = 'update'
				reverse = true
			}

			reverse = reverse == null ? false 
				: reverse == 'reverse' 
				|| reverse

			// special case: 'update'
			method = method == 'update' ? [] : method

			// defaults...
			method = method 
				|| ((this.config['default-sort'] || 'image-date')
					+ (this.config['default-sort-order'] == 'reverse' ? ' reverse' : ''))

			// set sort method in data...
			this.data.sort_method = typeof(method) == typeof('str') ? method : method.join(' ')

			var expandMethods = function(m, seen){
				seen = seen || []
				if(seen.indexOf(m) >= 0){
					throw new Error('Sort method loop detected.')
				}
				var methods = that.config['sort-methods'] || []
				return (m instanceof Array ? 
						m 
						: that.expandSortMethod(m))
					.map(function(m){ 
						var a = SortActions.__sort_methods__[m]
							|| (that.__sort_methods__ && that.__sort_methods__[m])
						// expand local aliases...
						return m in methods ?
							   expandMethods(methods[m], seen.concat([m])) 
							// expand system aliases...
							: typeof(a) == typeof('str') ? 
								expandMethods(a, seen.concat([m]))
							: a instanceof Array ?
								a
							: m })
					// merge...
					.reduce(function(r, e){
						return r.concat(e instanceof Array ? e : [e]) }, []) }

			method = expandMethods(method)

			// get the reverse arity...
			var i = method.indexOf('reverse')
			while(i >=0){
				reverse = !reverse

				method.splice(i, 1)
				i = method.indexOf('reverse')
			}

			// can't sort if we know nothing about .images
			if(method && method.length > 0 && (!this.images || this.images.length == 0)){
				return
			}

			// build the compare routine...
			method = method
				// remove duplicate methods...
				// XXX should we keep the last occurrence or the first occurrence???
				.unique()
				.map(function(m){
					return (SortActions.__sort_methods__[m]
						|| (that.__sort_methods__ && that.__sort_methods__[m])
						// sort by attr path...
						|| function(){
							var p = m.split(/\./g)
							var _get = function(obj){
								if(obj == null){
									return null
								}
								for(var i=0; i<p.length; i++){
									obj = obj[p[i]]
									if(obj === undefined){
										return null
									}
								}
								return obj
							}
							return function(a, b){
								a = _get(this.images[a])
								b = _get(this.images[b])

								// not enough data to compare items, test next...
								if(a == null || b == null){
									return 0

								} else if(a == b){
									return 0
								} else if(a < b){
									return -1
								} else {
									return +1
								}
							}}).call(that) 
				})
				// terminator: keep current position...
				.concat([function(a, b){
					a = that.data.order.indexOf(a)
					b = that.data.order.indexOf(b)

					return a - b
				}])

			// prepare the cmp function...
			var cmp = method.length == 1 ? 
				method[0] 
				// chain compare -- return first non equal (non-0) result...
				: function(a, b){
					var res = 0
					for(var i=0; i < method.length; i++){
						res = method[i].call(that, a, b)
						if(res != 0){
							return res
						}
					}
					return res
				}

			// do the sort (in place)...
			if(method && method.length > 0 && this.images){
				this.data.order = reverse ? 
					this.data.order.slice().sort(cmp.bind(this)).reverse()
					: this.data.order.slice().sort(cmp.bind(this))

			// just reverse...
			} else if(method.length <= 0 && reverse) {
				this.data.order.reverse()
			}

			this.data.updateImagePositions()
		}],

	// Toggle sort modes...
	//
	// This is similar to sort images but it will also maintain 
	// .data.manual_order state.
	//
	// NOTE: a state can be passed appended with reverse, e.g.
	// 		.toggleImageSort('Date') and .toggleImageSort('Date reverse')
	// 		both will set the sort method to 'Date' but the later will 
	// 		also reverse it.
	//
	// XXX should we merge manual order handling with .sortImages(..)???
	// XXX currently this will not toggle past 'none'
	toggleImageSort: ['- Edit|Sort/Image sort method',
		toggler.Toggler(null,
			function(){ 
				return (this.data 
					&& this.data.sort_method
					&& (this.data.sort_method
						.split(/'([^']*)'|"([^"]*)"| +/)
							.filter(function(e){ 
								return e && e.trim() != '' && !/['"]/.test(e) })[0]))
					|| 'none' },
			function(){ 
				return Object.keys(this.config['sort-methods'])
					// manual...
					.concat(this.data.sort_method == 'Manual' ? ['Manual'] : [])
					// list saved sorts...
					.concat(Object.keys(this.data.sort_order || {}))
					.unique()},
			// prevent setting 'none' as mode...
			function(mode){ 
				return !!this.images 
					&& (mode != 'none' 
						|| (mode == 'Manual' && (this.data.sort_cache || {})['Manual'])) },
			// XXX need to refactor the toggler a bit to make the 
			// 		signature simpler... (???)
			function(mode, _, reverse){ 
				reverse = reverse == 'reverse' || reverse
				var cache = this.data.sort_cache = this.data.sort_cache || {}
				var method = this.data.sort_method

				// cache sort order...
				if(method == 'Manual'){
					this.saveOrder(method)

				} else if(method && !(method in cache)){
					this.cacheOrder()
				}

				var sort = `"${mode}"`+ (reverse ? ' reverse' : '')

				// cached order...
				// XXX use load cache action...
				if(mode in cache
						|| sort in cache){
					var order = (cache[mode] || cache[sort]).slice()
					// invalid cache -> sort...
					if(order.length != this.data.order.length){
						// drop the cached order...
						delete cache[ mode in cache ? mode : sort ]
						this.sortImages(sort)

					// load cache...
					} else {
						this.data.order = order 
						this.sortImages('update' + (reverse ? ' reverse' : ''))
						this.data.sort_method = mode
					}

				// saved sort order...
				} else if(this.data.sort_order 
						&& mode in this.data.sort_order){
					this.loadOrder(mode, reverse)

				} else {
					this.sortImages(sort)
				}
			})],

	// XXX add drop/load actions...
	saveOrder: ['- Sort/',
		function(title){
			title = title || 'Manual'
			var cache = this.data.sort_order = this.data.sort_order || {}
			cache[title] = this.data.order.slice()
		}],
	loadOrder: ['- Sort/',
		function(title, reverse){
			var order = (this.data.sort_order || {})[title]
			if(order){
				this.data.order = order.slice()
				this.sortImages('update' + (reverse ? ' reverse' : ''))
				this.data.sort_method = title
			}
		}],

	// XXX add drop/load actions...
	cacheOrder: ['- Sort/',
		function(){
			var method = this.data.sort_method

			if(method){
				var cache = this.data.sort_cache = this.data.sort_cache || {}

				cache[method] = this.data.order.slice()
			}
		}],

	// Store/load sort data:
	// 	.data.sort_method		- current sort mode (optional)
	// 	.data.sort_order		- saved sort order (optional)
	// 	.data.sort_cache		- cached sort order (optional)
	load: [function(data){
		return function(){
			var that = this

			data.data
				&& ['sort_method', 'sort_order', 'sort_cache']
					.forEach(function(attr){
						if(data.data[attr]){
							that.data[attr] = data.data[attr]
						}
					})
		}
	}],
	json: [function(){
		return function(res){
			var that = this

			;['sort_method', 'sort_order', 'sort_cache']
				.forEach(function(attr){
					if(that.data[attr]){
						res.data[attr] = that.data[attr]
					}
				})

			// special case: unsaved manual order...
			if(this.toggleImageSort('?') == 'Manual'){
				res.data.sort_order = res.sort_order || {}
				res.data.sort_order['Manual'] = this.data.order.slice()
			}
		}
	}],
})

var Sort =
module.Sort = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'sort',
	depends: [
		'base',
		// XXX should we split this to edit/view???
		'edit',
	],
	suggested: [
		'ui-sort',
	],

	actions: SortActions,

	handlers: [
		['shiftImageRight shiftImageLeft',
			function(){
				this.data.sort_method = 'Manual'
			}],

		// maintain .sort_order and .sort_cache separately from .data in
		// the store...
		['prepareIndexForWrite',
			function(res){
				var c = res.changes

				if(!c){
					return
				}

				;['sort_order', 'sort_cache']
					.forEach(function(attr){
						if(!res.raw.data){
							return
						}
						if((c === true || c[attr]) && res.raw.data[attr]){
							// full save...
							if(c === true){
								res.index[attr] = res.raw.data[attr] 

							// build diff...
							} else {
								var diff = {}
								c[attr].forEach(function(k){ 
									diff[k] = res.raw.data[attr][k] })
								res.index[attr +'-diff'] = diff
							}

							// cleanup...
							delete res.index.data[attr]
						}
					})
			}],
		['prepareIndexForLoad',
			function(res){
				['sort_order', 'sort_cache']
					.forEach(function(attr){
						if(res[attr]){
							res.data[attr] = res[attr]
						}
					})
			}],

		// manage changes...
		['sortImages',
			function(_, target){ this.markChanged('data') }],
		// NOTE: this always saves to 'Manual' this is correct regardless
		// 		of save mode as in the current logic, the only mode that 
		// 		results from a manual shift is a manual sort...
		// 		XXX this may pose a problem with saved sorts, the question
		// 			is whether a saved mode can be edited or just saved or
		// 			updated...
		['shiftImageOrder',
			function(){ this.markChanged('sort_order', ['Manual']) }],

		['saveOrder', 
			function(_, title){ this.markChanged('sort_order', [title]) }],
		['cacheOrder', 
			function(){ this.markChanged('sort_cache', [this.data.sort_method]) }],
	],
})



//---------------------------------------------------------------------

// XXX add ability to partition ribbons in different modes...
// 		- by hour/day/month/year in date modes...
// 		- ???
var SortUIActions = actions.Actions({
	// XXX add links from method names to their expansions and actual 
	// 		methods (docs)...
	// 		...method docs do not exist at this point...
	// XXX do a better action calling scheme...
	showSortMethodDoc: ['- Sort/',
		widgets.makeUIDialog(function(method){
			var that = this
			var data = this.expandSortMethod(method)

			return $('<div class="help-dialog">')
				.append($('<div class="sort-method">')
					.prop('tabindex', true)
					.append($('<h2>')
						.text(method))
					.append($('<hr>'))
					// parse the action doc...
					.append($('<pre>')
						.html(
							'Sort order:\n  '
							+data
								.map(function(m){
									var e = that.expandSortMethod(m)
									return (e instanceof Array || typeof(e) == typeof('str')) ?
										`<a href="javascript:ig.showSortMethodDoc('${m}')">${m}</a>`
										: m })
								.join('\n  '))))
		})],

	// XXX should we be able to edit modes??? 
	// XXX should this be a toggler???
	sortDialog: ['Edit|Sort/Sort images...',
		widgets.makeUIDialog(function(){
			var that = this

			var dfl = this.config['default-sort'] 

			// XXX might be a good idea to make this generic...
			var _makeTogglHandler = function(toggler){
				return function(){
					var txt = $(this).find('.text').first().text()
					that[toggler]()
					o.update()
						.then(function(){ o.select(txt) })
					that.toggleSlideshow('?') == 'on' 
						&& o.parent.close()
				}
			}

			var o = browse.makeLister(null, function(path, make){
				var lister = this
				var cur = that.toggleImageSort('?')

				that.toggleImageSort('??').forEach(function(mode){
					// skip 'none'...
					if(mode == 'none'){
						return
					}
					make(mode, {
						cls: [
							(mode == cur ? 'highlighted selected' : ''),
							(mode == dfl ? 'default' : ''),
						].join(' '),
						// show only modes starting with upper case...
						hidden: mode[0].toUpperCase() != mode[0],
					})
						.on('open', function(){
							that.toggleImageSort(null, mode, 
								that.config['default-sort-order'] == 'reverse')
							lister.parent.close()
						})
				})	

				// Commands...
				make('---')

				make('$Reverse images')
					.on('open', function(){
						that.reverseImages()
						lister.parent.close()
					})

				// Settings...
				make('---')

				make(['Default order: ', that.config['default-sort-order'] || 'ascending'])
					.on('open', _makeTogglHandler('toggleDefaultSortOrder'))
					.addClass('item-value-view')
			})
			.run(function(){
				// handle '?' button to browse path...
				this.showDoc = function(){
					var method = this.select('!').text()
					method 
						&& method in that.config['sort-methods']
						&& that.showSortMethodDoc(method)
				}
				this.keyboard.handler('General', '?', 'showDoc')
			})

			return o
		})]	
})

var SortUI = 
module.SortUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-sort',
	depends: [
		'ui',
		'sort',
	],

	actions: SortUIActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
