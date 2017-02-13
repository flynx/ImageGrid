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
// XXX keep a cached sort order for each method in .data...
var SortActions = 
module.SortActions = actions.Actions({
	config: {
		// Default sort method...
		//
		// this can be:
		// 	- sort mode name		- as set in .config['sort-mode'] key
		// 								Example: 'Date'
		// 	- explicit sort method	- as set in .config['sort-mode'] value
		// 								Example: 'metadata.createDate birthtime'
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
			'Date': 'metadata.createDate birthtime name-sequence keep-position reverse',
			'Date (simple)': 'metadata.createDate birthtime keep-position reverse',
			'File date': 'birthtime keep-position reverse',
			'Name (XP-style)': 'name-leading-sequence name path keep-position',
			'File sequence number': 'name-sequence name path keep-position',
			'Name': 'name path keep-position',
			// XXX sequence number with overflow...
			//'File sequence number with overflow': 'name-leading-sequence name path',
		},
	},

	toggleDefaultSortOrder: ['- Edit|Sort/Default sort order',
		core.makeConfigToggler('default-sort-order', ['default', 'reverse'])],

	// Custom sort methods...
	//
	// Format:
	// 	{
	// 		<method-name>: function(a, b){ ... },
	// 		...
	// 	}
	//
	// NOTE: the cmp function is called in the actions context.
	//
	// XXX add sequence number with overflow...
	__sort_methods__: {
		'name-leading-sequence': function(a, b){
			a = this.images.getImageNameLeadingSeq(a)
			a = typeof(a) == typeof('str') ? 0 : a
			b = this.images.getImageNameLeadingSeq(b)
			b = typeof(b) == typeof('str') ? 0 : b

			return a - b
		},
		'name-sequence': function(a, b){
			a = this.images.getImageNameSeq(a)
			a = typeof(a) == typeof('str') ? 0 : a
			b = this.images.getImageNameSeq(b)
			b = typeof(b) == typeof('str') ? 0 : b

			return a - b
		},
		// This is specifically designed to terminate sort methods to prevent
		// images that are not relevant to the previous order to stay in place
		//
		// XXX need to test how will this affect a set of images where part
		// 		of the set is sortable an part is not...
		'keep-position': function(a, b){
			a = this.data.order.indexOf(a)
			b = this.data.order.indexOf(b)

			return a - b
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
	// 		 	'metadata.createDate birthtime' + ' reverse' 
	// 		will reverse the result's order while:
	// 		 	'metadata.createDate birthtime reverse' + ' reverese' 
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
				|| ((this.config['default-sort'] || 'birthtime')
					+ (this.config['default-sort-order'] == 'reverse' ? ' reverse' : ''))

			// set sort method in data...
			this.data.sort_method = typeof(method) == typeof('str') ? method : method.join(' ')

			// expand method names...
			// XXX should this be recursive???
			method = typeof(method) == typeof('str') ? 
				method
					.split(/'([^']*)'|"([^"]*)"| +/)
						.filter(function(e){ return e && e.trim() != '' && !/['"]/.test(e) })
					.map(function(m){ 
						return that.config['sort-methods'][m] || m })
					.join(' ')
				: method
			method = typeof(method) == typeof('str') ? 
				method.split(/'([^']*)'|"([^"]*)"| +/)
					.filter(function(e){ return e && e.trim() != '' && !/['"]/.test(e) })
				: method

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
				.unique()
				.map(function(m){
					return SortActions.__sort_methods__[m] 
						|| (that.__sort_methods__ && that.__sort_methods__[m])
						// sort by attr path...
						|| (function(){
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
							}})() 
				})

			// prepare the cmp function...
			var cmp = method.length == 1 ? 
				method[0] 
				// chain compare -- return first non equal (0) result...
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
							.filter(function(e){ return e && e.trim() != '' && !/['"]/.test(e) })[0]))
					|| 'none' },
			function(){ 
				return Object.keys(this.config['sort-methods'])
					.concat((this.data 
							&& ((this.data.sort_cache || {})['Manual'] 
								|| this.data.sort_method == 'Manual')) ? 
						['Manual'] 
						: [])},
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

				// save manual order...
				if(this.data.sort_method == 'Manual'){
					cache['Manual'] = this.data.order.slice()
				}

				// special case: manual order...
				if(mode == 'Manual'){
					this.data.order = cache['Manual'].slice()
					this.sortImages('update' + (reverse ? ' reverse' : ''))
					this.data.sort_method = mode

				} else {
					this.sortImages('"'+mode+'"' + (reverse ? ' reverse' : ''))
				}
			})],

	// Store/load sort data:
	// 	.data.sort_method		- current sort mode (optional)
	// 	.data.sort_cache		- manual sort order (optional)
	load: [function(data){
		return function(){
			if(data.data && data.data.sort_method){
				this.data.sort_method = data.data.sort_method
			}

			if(data.data && data.sort_cache){
				this.data.sort_cache = data.sort_cache
			}
		}
	}],
	// XXX should .sort_cache be stored separately???
	json: [function(){
		return function(res){
			if(this.data.sort_method){
				res.data.sort_method = this.data.sort_method
			}

			if(this.data.sort_cache){
				res.sort_cache = this.data.sort_cache
			}

			if(this.toggleImageSort('?') == 'Manual'){
				res.sort_cache = res.sort_cache || {}
				res.sort_cache['Manual'] = this.data.order.slice()
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
		'changes',
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

		['prepareIndexForWrite',
			function(res){
				var changed = this.changes == null 
					|| this.changes.sort_cache

				if(changed && res.raw.sort_cache){
					res.index['sort_cache'] = res.raw.sort_cache 
				}
			}],

		// manage changes...
		// XXX also need to mark 'sort_cache'
		['sortImages',
			function(_, target){ this.markChanged('data') }],
	],
})



//---------------------------------------------------------------------

// XXX add ability to partition ribbons in different modes...
// 		- by hour/day/month/year in date modes...
// 		- ???
var SortUIActions = actions.Actions({
	// XXX should we be able to edit modes??? 
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
					make(mode)
						.on('open', function(){
							that.toggleImageSort(null, mode, 
								that.config['default-sort-order'] == 'reverse')
							lister.parent.close()
						})
						.addClass(mode == cur ? 'highlighted selected' : '')
						.addClass(mode == dfl ? 'default' : '')
				})	

				// Commands...
				make('---')

				make('Reverse images')
					.on('open', function(){
						that.reverseImages()
						lister.parent.close()
					})
				/*
				make('Reverse ribbons')
					.on('open', function(){
						that.reverseRibbons()
						lister.parent.close()
					})
				*/

				// Settings...
				make('---')

				make(['Default order: ', that.config['default-sort-order'] || 'ascending'])
					.on('open', _makeTogglHandler('toggleDefaultSortOrder'))
					.addClass('item-value-view')
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
