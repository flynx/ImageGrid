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
		//
		// XXX should 'reverse' position have an effect???
		// 		...currently only arity is used...
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

			'Ribbon order':
				'sort-via-ribbons keep-position',
			'Reverse ribbon order':
				'sort-via-ribbons-reverse keep-position',

			// aliases...
			'example-sort-alias':
				'Date "File date" Name',
		},
	},

	toggleDefaultSortOrder: ['- Edit|Sort/Default sort order',
		core.makeConfigToggler('default-sort-order', ['default', 'reverse'])],

	// helpers...
	// XXX should these be actions???
	// XXX de we need this to be recursive???
	// 		...or do we need a recursive expansion action???
	getSortMethods: ['- Sort/',
		core.doc`Get sort method value...

			Get all methods...
			.getSortMethods()
				-> methods

			Get one specific method...
			.getSortMethods(method)
				-> [method, ..]
				-> null

			Get specific methods...
			.getSortMethods(method, method, ..)
			.getSortMethods([method, method, ..])
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
					.flat() }
			var get = function(name){
				// normalize name...
				name = name
					.trim()
					// remove quotes...
					.replace(/^(["'])([^'"]*)(\1)$/, '$2')
				var m = that.config['sort-methods'][name]
					|| (that.__sort_methods__ 
						&& that.__sort_methods__[name])
					|| SortActions.__sort_methods__[name]
				return typeof(m) == typeof('str') ? 
					splitMethods(m) 
					: m }

			// return a single method...
			if(!(methods instanceof Array)){
				return actions.ASIS(
					get(methods) 
					|| that.getSortMethods(splitMethods(methods))
					|| null) }

			// return multiple methods...
			var res = {}
			methods
				.forEach(function(m){ 
					res[m] = m == 'reverse' ?
						(res[m] || []).concat([m])
						: get(m) })
			return res }],
	// XXX should this count 'reverese' arity???
	expandSortMethod: ['- Sort/',
		core.doc`Build list of basic sort methods...

			.expandSortMethod(method)
				-> methods

		The resulting list will contain either field names or method names 
		contained in .__sort_methods__

		NOTE: this will not remove repeating methods.
		`,
		function(method, seen){
			var that = this
			var reverse = false
			seen = seen || []
			if(seen.indexOf(method) >= 0){
				throw new Error('Sort method loop detected.') }
			var methods = that.config['sort-methods'] || []

			return (method instanceof Array ? 
					method 
					: that.getSortMethods(method)
						.run(function(){
							return Object.entries(this)
								.map(function([key, value]){
									return value == null ? 
										key 
										: value })
								.flat() }))
				.map(function(method){ 
					var a = SortActions.__sort_methods__[method]
						|| (that.__sort_methods__ && that.__sort_methods__[method])
					// expand local aliases...
					return method in methods ?
						   that.expandSortMethod(methods[method], seen.concat([method])) 
						// expand system aliases...
						: typeof(a) == typeof('str') ? 
							that.expandSortMethod(a, seen.concat([method]))
						: a instanceof Array ?
							a
						: method })
				// count reverse arity...
				.filter(function(e){
					reverse = e == 'reverse' ? !reverse : reverse
					return e != 'reverse' })
				.concat(reverse ? 
					'reverse' 
					: [])
				.flat() }],

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
			'metadata.date/timeOriginal file-date name-sequence',
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

				return a - b } },
		'name-sequence': function(){
			return function(a, b){
				a = this.images.getImageNameSeq(a)
				a = typeof(a) == typeof('str') ? 0 : a
				b = this.images.getImageNameSeq(b)
				b = typeof(b) == typeof('str') ? 0 : b

				return a - b } },
		// NOTE: this will actually sort twice, stage one build sort index and
		// 		second stage is a O(n) lookup cmp...
		// 		XXX not sure if this is the best way to go...
		// XXX add ability to rotate sections...
		'name-sequence-overflow': function(){
			var that = this

			var logger = this.logger 
				&& this.logger.push('Sort indexing')
			logger && logger.emit('queued', 'sequence sections')

			// gap and gap length...
			var gap = -1
			var l = 1

			var lst = this.images
				.map(function(gid){ 
					return [gid, that.images.getImageNameSeq(gid)] })
				// keep only items with actual sequence numbers...
				.filter(function([_, s]){
					return typeof(s) == typeof(123) })
				// sort by sequence...
				.sort(function([x, a], [y, b]){ 
					return a - b })
				// find largest gaps...
				.map(function(e, i, lst){
					var c = (lst[i+1] || e)[1] - e[1]
					if(c > l){
						l = c
						gap = i }
					return e })

			// calc gap between min/max accounting for overflow...
			var a = lst[0][1]
			var b = lst.slice(-1)[0][1]
			var c = a + ( 10 ** (''+b).length ) - b - 2
			if(c > l){
				l = c
				gap = -1 }

			// rotate index blocks...
			if(l > 1 && gap >= 0){
				var tail = lst.splice(gap+1, lst.length)
				lst = tail.concat(lst) }

			// build the actual lookup table...
			var index = {}
			lst.forEach(function(e, i){
				index[e[0]] = i })

			logger && logger.emit('done', 'sequence sections')

			// return the lookup cmp...
			return function(a, b){
				return (index[a] || 0) - (index[b] || 0) } },

		// Keep image order in each ribbon the same but sort ribbons (i.e. 
		// images within ribbons) in ribbon order...
		//
		// e.g. all images in ribbon N are after images of ribbon <N 
		// and before images in ribbons >N
		'sort-via-ribbons': function(reverse){
			var that = this

			var logger = this.logger 
				&& this.logger.push('Sort indexing')
			logger && logger.emit('queued', 'ribbon order')

			var index = new Map(
				this.data.ribbon_order
					// reverse?
					.run(function(){
						return reverse ?
							this.slice().reverse()
							: this })
					.map(function(gid){
						return that.data.ribbons[gid] })
					.flat()
					.compact()
					.map(function(e, i){ 
						return [e, i] }))

			logger && logger.emit('done', 'ribbon order')

			return function(a, b){
				a = index.get(a)
				b = index.get(b)
				return (a === undefined || b === undefined) ?
					0
					: a - b } },
		'sort-via-ribbons-reverse': function(){
			return SortActions.__sort_methods__['sort-via-ribbons'].call(this, true) },

		// This is specifically designed to terminate sort methods to prevent
		// images that are not relevant to the previous order to stay in place
		//
		// If this is explicitly included then 'reverse' order is ignored.
		//
		// XXX need to test how will this affect a set of images where part
		// 		of the set is sortable an part is not...
		// XXX legacy: this is added to every sort automatically...
		// 		...do we still need this here???
		'keep-position': function(){
			var order = this.data.order_index
			return function(a, b){
				return order[a] - order[b] } },
	},
	// XXX would be nice to be able to sort a list of gids or a section
	// 		of images...
	// XXX should this handle manual sort order???
	// XXX should reverse position have an effect???
	// 		...currently only reverse arity is used...
	sortImages: ['- Edit|Sort/Sort images',
		core.doc`Sort images...
	
		Sort using the default sort method
		 .sortImages()
			NOTE: the actual sort method used is set via 
				.config['default-sort'] and .config['default-sort-order']
		
		Sort using a specific method(s):
		.sortImages(<method>)
		.sortImages(<method>, <reverse>)
		
		.sortImages('<method> ..')
		.sortImages('<method> ..', <reverse>)
		
		.sortImages([<method>, ..])
		.sortImages([<method>, ..], <reverse>)
			NOTE: <method> can either be one of:
				1) method name (key) from .config['sort-methods']
				2) a space separated string of methods or attribute paths
					as in .config['sort-methods']'s values.
				for more info se doc for: .config['sort-methods']
			NOTE: if it is needed to reverse the method by default just
				add 'reverse' to it's string.
		
		Update current sort order:
		.sortImages('update')
			NOTE: unless the sort order (.data.order) is changed manually
				this will have no effect.
			NOTE: this is designed to facilitate manual sorting of 
				.data.order
		
		Reverse image order:
		.sortImages('reverse')
		
		
		NOTE: if a sort method name contains a space it must be quoted either
			in '"'s or in "'"s.
		NOTE: reverse is calculated by oddity -- if an odd number indicated
			then the result is reversed, otherwise it is not. 
			e.g. adding:
				'metadata.createDate birthtime ctime' + ' reverse' 
			will reverse the result's order while:
				'metadata.createDate birthtime ctime reverse' + ' reverese' 
			will cancel reversal.
		NOTE: with empty images this will not do anything.
		`,
		function(method, reverse){ 
			var that = this

			if(method == 'reverse'){
				method = 'update'
				reverse = true }

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
			this.data.sort_method = typeof(method) == typeof('str') ? 
				method 
				: method.join(' ')

			method = this.expandSortMethod(method + (reverse ? ' reverse' : ''))

			// get the reverse arity...
			reverse = method[method.length - 1] == 'reverse'
			reverse
				&& method.pop()
			reverse = reverse 
				&& !method.includes('keep-position')

			// can't sort if we know nothing about .images
			if(method && method.length > 0 && (!this.images || this.images.length == 0)){
				return }

			// build the compare routine...
			method = method
				// remove duplicate methods...
				.unique()
				.concat(['keep-position'])
				.tailUnique()
				.map(function(m){
					return (SortActions.__sort_methods__[m]
						|| (that.__sort_methods__ && that.__sort_methods__[m])
						// sort by attr path...
						|| function(){
							var p = m.split(/\./g)
							// get attr...
							var _get = function(obj){
								if(obj == null){
									return null }
								for(var i=0; i<p.length; i++){
									obj = obj[p[i]]
									if(obj === undefined){
										return null } }
								return obj }
							return function(a, b){
								a = _get(this.images[a])
								b = _get(this.images[b])

								if(a == b
										// not enough data to compare items, test next...
										|| (a == null && b == null)){
									return 0
								} else if(a < b 
										// keep stuff without value at the end...
										|| a == null){
									return -1
								} else {
									return +1 }
							}}).call(that) })

			// prepare the cmp function...
			var cmp = method.length == 1 ? 
				method[0] 
				// chain compare -- return first non equal (non-0) result...
				: function(a, b){
					var res = 0
					for(var i=0; i < method.length; i++){
						res = method[i].call(that, a, b)
						if(res != 0){
							return res } }
					return res }

			// do the sort (in place)...
			if(method && method.length > 0 && this.images){
				this.data.order = 
					reverse ? 
						this.data.order.slice().sort(cmp.bind(this)).reverse()
						: this.data.order.slice().sort(cmp.bind(this))

			// just reverse...
			} else if(method.length <= 0 && reverse) {
				this.data.order.reverse() }

			this.data.updateImagePositions() }],

	// XXX should we merge manual order handling with .sortImages(..)???
	// XXX currently this will not toggle past 'none'
	toggleImageSort: ['- Edit|Sort/Image sort method',
		core.doc`Toggle sort modes...
		
		This is similar to sort images but it will also maintain 
		.data.manual_order state.
		
		NOTE: a state can be passed appended with reverse, e.g.
			.toggleImageSort('Date') and .toggleImageSort('Date reverse')
			both will set the sort method to 'Date' but the later will 
			also reverse it.
		`,
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
					.unique() },
			// prevent setting 'none' as mode...
			function(mode){ 
				return !!this.images 
					&& (mode != 'none' 
						|| (mode == 'Manual' && (this.data.sort_cache || {})['Manual'])) },
			// XXX need to refactor the toggler a bit to make the 
			// 		signature simpler... (???)
			function(mode, _, reverse){ 
				reverse = reverse || ''
				reverse = reverse === true ? 'reverse' : reverse
				var cache = this.data.sort_cache = this.data.sort_cache || {}
				var method = this.data.sort_method

				// cache sort order...
				method == 'Manual'
					&& this.saveOrder(method)

				var sort = `"${mode}" `+ reverse

				// saved sort order...
				;(this.data.sort_order 
						&& mode in this.data.sort_order) ?
					this.loadOrder(mode, reverse == 'reverse')
					: this.sortImages(sort) })],

	// XXX add drop/load actions...
	saveOrder: ['- Sort/',
		function(title){
			title = title || 'Manual'
			var cache = this.data.sort_order = this.data.sort_order || {}
			cache[title] = this.data.order.slice() }],
	loadOrder: ['- Sort/',
		function(title, reverse){
			var order = (this.data.sort_order || {})[title]
			if(order){
				this.data.order = order.slice()
				this.sortImages('update' + (reverse ? ' reverse' : ''))
				this.data.sort_method = title } }],

	// XXX add drop/load actions...
	cacheOrder: ['- Sort/',
		function(){
			var method = this.data.sort_method
			if(method){
				var cache = this.data.sort_cache = this.data.sort_cache || {}
				cache[method] = this.data.order.slice() } }],

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
							that.data[attr] = data.data[attr] } }) } }],
	json: [function(){
		return function(res){
			var that = this
			;['sort_method', 'sort_order', 'sort_cache']
				.forEach(function(attr){
					if(that.data[attr]){
						res.data[attr] = that.data[attr] } })
			// special case: unsaved manual order...
			if(this.toggleImageSort('?') == 'Manual'){
				res.data.sort_order = res.sort_order || {}
				res.data.sort_order['Manual'] = this.data.order.slice() } } }],
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
				this.data.sort_method = 'Manual' }],

		// maintain .sort_order and .sort_cache separately from .data in
		// the store...
		['prepareIndexForWrite',
			function(res){
				var c = res.changes

				if(!c){
					return }

				;['sort_order', 'sort_cache']
					.forEach(function(attr){
						if(!res.raw.data){
							return }
						if((c === true || c[attr]) && res.raw.data[attr]){
							// full save...
							if(c === true){
								res.index[attr] = res.raw.data[attr] 

							// build diff...
							} else {
								var diff = {}
								c[attr].forEach(function(k){ 
									diff[k] = res.raw.data[attr][k] })
								res.index[attr +'-diff'] = diff }

							// cleanup...
							delete res.index.data[attr] } }) }],
		['prepareIndexForLoad',
			function(res){
				['sort_order', 'sort_cache']
					.forEach(function(attr){
						if(res[attr]){
							res.data[attr] = res[attr] } }) }],

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
	config: {
		// If true expand the sort method alias tree...
		//
		'sort-doc-expand-methods': true,
	},

	// XXX add links from method names to their expansions and actual 
	// 		methods (docs)...
	// 		...method docs do not exist at this point...
	// XXX do a better action calling scheme...
	// XXX should we also have a doc text??
	// 		...if yes then it's a question where/how to store it...
	showSortMethodDoc: ['- Sort/',
		core.doc`Show sort method documentation...

			Show sort method doc...
			.showSortMethodDoc(method)

			Show sort method doc with expanded method list...
			.showSortMethodDoc(method, true)

			Show sort method doc with flat method list...
			.showSortMethodDoc(method, false)

		This will add actions with .sortMethod attribute as sort methods...
		`,
		widgets.makeUIDialog(function(method, expand, indent){
			var that = this
			expand = expand || this.config['sort-doc-expand-methods'] || false
			indent = indent || '  '

			var expandMethods = function(method){
				var methods = that.getSortMethods(method)
				return [ methods instanceof Array || typeof(methods) == typeof('str') ? 
						`<a href="javascript:ig.showSortMethodDoc('${method}', ${expand})">${method}</a>`
						: method ]
					.concat(
						methods instanceof Array ?
							methods
								.map(!expand ? 
									// !expand -> keep only the first/root item...
									function(e){ 
										return expandMethods(e)[0] || [] } 
									: expandMethods)
								.flat()
								.map(function(e){ 
									return indent + e })
						: typeof(methods) == typeof('str') ?
							[indent + methods]
						: []) }

			return $('<div class="help-dialog">')
				.append($('<div class="sort-method">')
					.prop('tabindex', true)
					.append($('<h2>')
						.text(method))
					.append($('<hr>'))
					.append($('<pre>')
						.html(
							'Sort order:\n  '
							+ this.expandSortMethod(method)
								.unique()
								.join(', ')
							+'\n\n'
							+'Sort method tree:\n'
							+ expandMethods(method)
								// ignore the first item as we mention 
								// it in the title...
								.slice(1)
								.join('\n')))) })],

	// XXX should we be able to edit modes??? 
	// XXX should this be a toggler???
	// XXX add "New from current order..."
	sortDialog: ['Edit|Sort/Sort images...',
		widgets.makeUIDialog(function(){
			var that = this

			var dfl = this.config['default-sort'] 

			var sort_actions = new Map(
				that.actions
					.filter(function(e){ 
						return that.getActionAttr(e, 'sortMethod') })
					.map(function(e){
						return [
							(that.getActionAttr(e, 'doc') || e).split(/[\\\/:]/).pop(),
							e, 
						] }))

			// XXX might be a good idea to make this generic...
			var _makeTogglHandler = function(toggler){
				return function(){
					var txt = $(this).find('.text').first().text()
					that[toggler]()
					o.update()
						.then(function(){ o.select(txt) })
					that.toggleSlideshow('?') == 'on' 
						&& o.parent.close() } }

			var o = browse.makeLister(null, function(path, make){
				var lister = this
				var cur = that.toggleImageSort('?')

				// normal sort methods...
				that.toggleImageSort('??')
					.forEach(function(mode){
						// skip 'none'...
						if(mode == 'none'){
							return }
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
							lister.parent.close() }) })	
				// action sort methods...
				if(sort_actions.size > 0){
					// XXX do we need this??
					//make('---', {style: { opacity: 0.1, }})
					;[...sort_actions.entries()]
						.forEach(function([n, a]){
							make(n, {
								disabled: that.getActionMode(a) == 'disabled',
							})
							.on('open', function(){
								that[a]()
								make.dialog.close() }) }) }

				// Commands...
				make('---')

				make('$Reverse images')
					.on('open', function(){
						that.reverseImages()
						lister.parent.close() })

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
					method = sort_actions.get(method) || method

					// normal sort method...
					if(method in that.config['sort-methods']){
						that.showSortMethodDoc(method) 

					// sort action...
					} else if(method in that){
						that.showDoc(method) } }
				this.keyboard.handler('General', '?', 'showDoc') })

			return o })],
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
