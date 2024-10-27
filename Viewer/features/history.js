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
// url history...

var URLHistoryActions = actions.Actions({
	config: {
		'url-history-push-up-on-open': false,

		// values:
		// 	-1		- no limit.
		// 	0		- disabled
		// 	1+		- length of history
		//
		// NOTE: this does not account for pinned items.
		'url-history-length': 100,
	},

	__url_history: null,

	// Format:
	// 	{
	// 		url: {
	// 			open: <action-name> | <function>,
	// 			check: <action-name> | <function>,
	// 		},
	// 		...
	// 	}
	//
	// NOTE: last opened url is last in object, i.e. the keys are in 
	// 		reverse order...
	// NOTE: though functions are supported they are not recommended as
	// 		we can not stringify them to JSON...
	get url_history(){
		return this.hasOwnProperty('__url_history') ? this.__url_history : undefined },
	set url_history(value){
		this.__url_history = value },

	// NOTE: this is created on the fly as a convenience, editing this 
	// 		will have no effect...
	get url_history_pinned(){
		var url_history = this.url_history
		return Object.keys(url_history || {})
			.reduce(function(res, k){ 
				if(url_history[k].pinned){
					res[k] = url_history[k]
				}
				return res 
			}, {}) },


	clone: [function(full){
		return function(res){
			res.url_history = null
			if(full && this.url_history){
				res.url_history = JSON.parse(JSON.stringify(this.url_history))
			}
		}
	}],

	// NOTE: this updates .url_history in-place...
	setTopURLHistory: ['- History/',
		function(url){
			var data = this.url_history[url]

			if(data == null){
				return
			}

			delete this.url_history[url]
			this.url_history[url] = data
		}],
	// NOTE: this will overwrite .url_history object...
	// XXX should this be in-place or overwrite by default???
	sortURLHistory: ['- History/',
		function(order, in_place){
			var that = this
			var data = this.url_history
			var ordered = {}

			if(in_place){
				order
					.unique()
					.reverse()
					.forEach(function(url){
						that.setTopURLHistory(url) })

			} else {
				order
					.concat(
						Object.keys(data)
							.reverse())
					.unique()
					.reverse()
					.forEach(function(url){
						url in data
							&& (ordered[url] = data[url]) })

				// sanity check...
				if(Object.keys(data).length != Object.keys(ordered).length){
					console.error('Something went wrong with sort:', ordered)
					return
				}

				this.url_history = ordered
			}
		}],
	// NOTE: if clear is not true then this will update a history item 
	// 		rather than fully rewriting it...
	// NOTE: this will not auto-remove pinned items if the length of 
	// 		history is more than allowed...
	pushURLToHistory: ['- History/',
		function(url, open, check, clear){
			var that = this
			url = url || this.location.path
			var l = this.config['url-history-length'] || -1

			var logger = this.logger 
				&& this.logger.push('History')

			if(l == 0){
				return
			}

			this.url_history = this.url_history || {}
			var item = !clear ? (this.url_history[url] || {}) : {}

			open = item.open = open || this.location.load
			check = item.check = check || this.location.check || 'checkPath'

			// remove the old value...
			if(url in this.url_history && this.config['url-history-push-up-on-open']){
				delete this.url_history[url]
			}

			// push url to history...
			this.url_history[url] = item

			// update history length...
			var to_remove = Object.keys(this.url_history)
				// we will not remove pinned items...
				.filter(function(e){
					// NOTE: .pinned can be 0 so we can't just use 
					// 		that.url_history[e].pinned as a test...
					return that.url_history[e].pinned == null })
			// we clear the head of the list -- first/oldest urls added...
			to_remove.reverse()
			// do the actual removal...
			to_remove
				.slice(l)
				.forEach(function(e){
					// XXX not sure if this is needed here...
					logger
						&& logger.emit(`Auto-removing URL from history: "${e}"`)
					that.dropURLFromHistory(e) })
		}],
	// NOTE: url can be an index, 0 being the last url added to history;
	// 		negative values are also supported.
	dropURLFromHistory: ['- History/', 
		function(url){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			if(url){
				delete this.url_history[url]
			}
		}],
	checkURLFromHistory: ['- History/',
		function(url){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			// if we have a check action then use it...
			if(url && this.url_history[url] && this.url_history[url].check){
				var check = this.url_history[url].check

				if(check === true || check === false){
					return check

				} else if(typeof(check) == typeof('str')){
					return this[check](url)

				} else {
					return check(url)
				}

			// no way to check so we do not know...
			} else {
				return null
			}
		}],
	pinnedURLOrder: ['- History/',
		core.doc`Get/set history pin order

			Get pin order...
			.pinnnedURLOrder(<url>)
				-> order

			Set pin order...
			.pinnnedURLOrder(<url>, <order>)
				-> this

			Set pin order to 'auto'...
			.pinnnedURLOrder(<url>, 'auto')
				-> this

		Auto-ordered pins are sorted in the same order as .url_history

		NOTE: this will not reset the pin, use .toggleURLPinned(..) for that
		`,
		function(url, order){
			var e = this.url_history[url]
			// get...
			if(order == null){
				return e.pinned === true ? 'auto'
					: 'pinned' in e ? e.pinned
					: null

			// set...
			} else {
				e.pinned = order == 'auto' ? true : order
			}
		}],
	toggleURLPinned: ['History/',
		toggler.Toggler(
			function(){ return this.location.path },
			function(url, action){
				var e = this.url_history[url]

				// get state...
				if(action == null){
					return (e && e.pinned != null) ? 'on' : 'off'

				// change state -> 'on'...
				} else if(action == 'on'){
					e.pinned = true

				// change state -> 'off'...
				} else if(action == 'off'){
					delete e.pinned
				}
			}, 
			['off', 'on'])],
	openURLFromHistory: ['- History/',
		function(url, open){
			this.url_history = this.url_history || {}

			url = typeof(url) == typeof(123) ? 
				Object.keys(this.url_history).reverse().slice(url)[0]
				: url

			if(url && !open && this.url_history[url] && this.url_history[url].open){
				open = this.url_history[url].open
			}

			if(url && open){
				if(open instanceof Function){
					return open(url)

				} else {
					return this[open](url)
				}
			}
		}],
	openPreviousLoadedURL: ['History/Load previously loaded url',
		core.doc`

			NOTE: this will only work if .config['url-history-last-loaded'] is 
				present in .url_history, otherwise this is a no-op.
			`,
		function(){
			var last = this.config['url-history-last-loaded']

			last in this.url_history
				&& this.openURLFromHistory(last)
		}],	
	clearURLHistory: ['History/', 
		function(){ this.url_history = null }],
})


var URLHistory = 
module.URLHistory = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'url-history',
	depends: [
		'location',
	],
	suggested: [
		'ui-url-history',
		'url-history-local-storage',
		'url-history-fs-writer',
	],

	actions: URLHistoryActions,

	handlers: [
		// maintain .config['url-history-last-loaded']
		['load.pre',
			function(){
				var prev = (this.location && this.location.path) ?
					this.location.path 
					: null
				return prev 
					&& function(){
						prev != this.config['url-history-last-loaded'] 
							&& prev != this.location.path
							&& (this.config['url-history-last-loaded'] = prev) }
			}],
	],
})


//---------------------------------------------------------------------

// XXX should this be responsible for saving and loading of .location???
// 		...on one hand it's part of the history, on the other it's part 
// 		of file loader...
var URLHistoryLocalStorageActions = actions.Actions({
	config: {
		'url-history-local-storage-key': 'url-history',
		'url-history-loaded-local-storage-key': 'url-history-loaded',
		'url-history-load-current': true,

		'url-history-last-loaded': null,
	},

	__url_history: null,

	// load url history...
	get url_history(){
		// get the attr value...
		if(this.hasOwnProperty('__url_history') && this.__url_history){
			return this.__url_history
		}

		var key = this.config['url-history-local-storage-key']
		if(key){
			// get the storage value...
			// if not local __url_history and we are configured, load from storage...
			if(this.config && key){
				var history = localStorage[key]
				if(history){
					try{
						this.__url_history = JSON.parse(history)

					} catch(e) {
						delete localStorage[key]
					}
				}
			}
		}

		return this.hasOwnProperty('__url_history') ? this.__url_history : null
	},
	set url_history(value){
		this.__url_history = value

		var key = this.config['url-history-local-storage-key']
		if(key){
			localStorage[key] = JSON.stringify(value) 
		}
	},


	// Disable localStorage in child...
	clone: [function(){
		return function(res){
			res.config['url-history-local-storage-key'] = null
			res.config['url-history-loaded-local-storage-key'] = null
		}
	}],

	storeURLHistory: ['History/',
		function(){
			var history = this.config['url-history-local-storage-key']
			if(history != null){
				localStorage[history] = 
					JSON.stringify(this.url_history) 
			}

			this.storeLocation()
		}],
	storeLocation: ['History/',
		function(){
			var loaded = this.config['url-history-loaded-local-storage-key']

			if(loaded != null){
				localStorage[loaded] = JSON.stringify(this.location || {})
			}
		}],
	loadLastSavedBasePath: ['- History/',
		function(){
			var loaded = this.config['url-history-loaded-local-storage-key']

			if(loaded && localStorage[loaded]){
				var l = JSON.parse(localStorage[loaded])

				if(l.current != null && this.config['url-history-load-current']){
					this.one('load', function(){
						this.current = l.current
					})
				}

				this.openURLFromHistory(l.path, l.load)

			} else {
				this.openURLFromHistory(0)
			}
		}],
})

var URLHistoryLocalStorage = 
module.URLHistoryLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'url-history-local-storage',
	depends: [
		'ui',
		'url-history',
	],

	isApplicable: function(){ 
		return typeof(localStorage) != 'undefined' 
			&& localStorage != null },

	actions: URLHistoryLocalStorageActions,

	// NOTE: loading is done by the .url_history prop...
	handlers: [
		['ready',
			function(){ 
				;(typeof(process) != 'undefined' 
						&& process.env.IMAGEGRID_PATH
						&& this.loadIndex) ?
					this.loadIndex(process.env.IMAGEGRID_PATH) 
					: this.loadLastSavedBasePath() }], 

		['stop.pre',
			function(){ this.storeURLHistory() }], 

		// save base_path...
		['load', 
			function(){ this.location && this.location.path && this.storeLocation() }],

		// save...
		['pushURLToHistory dropURLFromHistory setTopURLHistory', 
			function(){ 
				this.storeURLHistory()
			}],
		// clear...
		['clearURLHistory.pre',
			function(){
				delete this.__url_history

				var history = this.config['url-history-local-storage-key']
				if(history){
					delete localStorage[history]
				}

				var loaded = this.config['url-history-loaded-local-storage-key']
				if(loaded){
					delete localStorage[loaded]
				}
			}],
	],
})


// XXX
var URLHistoryFSWriter = 
module.URLHistoryFSWriter = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'url-history-fs-writer',
	depends: [
		'fs-writer',
		'url-history-local-storage',
	],

	config: {
		// XXX should we add a toggler action to toggle this?
		'url-history-push-to-top-on-save': false,
	},

	handlers: [
		['saveIndex',
			function(res){ 
				var that = this
				res.then(function(l){
					// push saved to top...
					if(that.config['url-history-push-to-top-on-save']){
						that.pushURLToHistory(l.path, l.load)

					// update...
					} else {
						var e = that.url_history[l.path]
						if(e != null){
							e.open = l.load
							that.storeURLHistory()

						} else {
							that.pushURLToHistory(l.path, l.load)
						}
					}
				})
			}], 
	],
})



//---------------------------------------------------------------------

var URLHistoryUIActions = actions.Actions({
	config: {
		// If true pushing the pin item button will also focus the item
		//
		// NOTE: Both settings have their pluses and minuses:
		// 		enabled (true)
		// 			+ will keep the item on screen
		// 			- will lose context
		// 		disabled (false)
		// 			+ will keep context
		// 			- will lose the item from view if list is long
		'url-history-focus-on-pin': false,
	},

	// XXX add option to force full update on dialog.update() (???)
	listURLHistory: ['History|File/Location history...',
		widgets.makeUIDialog(function(mode){
			var that = this
			var data
			var orig_pins
			var cur = this.location.path
			// NOTE: if doing intermediate/live saves this would need to
			//		be set to false on state update...
			var state_saved = false

			var to_sort = []
			var to_remove = []
			// cached fs state...
			var fs_state = {}

			// NOTE: this would require the dialog to be updated if it's
			// 		not closed...
			var save = function(){
				if(state_saved){
					return
				}
				state_saved = true

				var pins = data.pins

				// remove items...
				to_remove.forEach(function(e){
					that.dropURLFromHistory(e)
					// pins...
					var i = pins.indexOf(e)
					i >= 0
						&& pins.splice(i, 1)
					// urls to be sorted...
					i = to_sort.indexOf(e)
					i >= 0
						&& to_sort.splice(i, 1)
				})
				to_remove = []

				// sort history...
				that.sortURLHistory(to_sort, true)
				// toggle pins...
				pins
					.concat(orig_pins || [])
					.unique()
					.forEach(function(p){
						pins.indexOf(p) < 0 		
							&& that.toggleURLPinned(p, 'off')
						orig_pins.indexOf(p) < 0 		
							&& that.toggleURLPinned(p, 'on')
					})
				// sort pins...
				pins
					.forEach(function(p, i){
						that.pinnedURLOrder(p, i) })
			}
			var makeHistoryList = function(fs_state){
				fs_state = fs_state || {}
				var history = Object.keys(that.url_history).reverse()
				var pinned_auto = []
				var pinned_sorted = []

				var list = history 
					// NOTE: this might get a little slow for 
					// 		very large sets...
					.map(function(p){
						// pinned items...
						var pin = that.pinnedURLOrder(p)
						pin == 'auto' ? pinned_auto.push(p)
							// prepare for sort...
							: pin != null ? pinned_sorted.push([p, pin])
							: null
						return p
					})

				// sort pins...
				pinned_sorted = pinned_sorted
					.sort(function(a, b){ return a[1] - b[1] })
					.map(function(e){ return e[0] })

				return {
					urls: list,
					pins: pinned_sorted.concat(pinned_auto),
				}
			}
			var makeDisabledChecker = function(fs_state){
				return function(url){
					// see of we need a full refresh or use the last fs_state...
					return url in fs_state ?
						fs_state[url]
						: (fs_state[url] = !that.checkURLFromHistory(url)) } }

			var dialog = browse.makeLister(null, function(path, make){
				// live update...
				// XXX add option to force full update???
				data = data == null ? makeHistoryList(fs_state) : data
				orig_pins = orig_pins == null ? data.pins.slice() : orig_pins

				// special case: empty list...
				if(data.urls.length == 0){
					make.Action('No history...', {disabled: true})
					return
				} 

				make.EditablePinnedList(data.urls, data.pins, { 
					list_id: 'history',
					new_item: false,
					pins_sortable: true,
					isItemDisabled: makeDisabledChecker(fs_state),
					to_remove: to_remove,
					buttons: [
						// open...
						['<span class="show-on-hover">&#8599;</span>', 
							function(p){ dialog.browsePath(p) }],
						['&diams;', 'TO_TOP'],
						'PIN',
						'REMOVE',
					],
				})
				make
					.done()
					// highlight the current item...
					.then(function(){
						dialog
							.filter(`"${cur}"`)
							.addClass('highlighted') })
			}, 
			{
				cls: 'location-history',
				// NOTE: we are not using path: here because it will parse
				// 		the current element as a path, and we need it as-is... 
				selected: cur,
			})
			.open(function(evt, path){ 
				dialog.close() 
				that.openURLFromHistory(path)
			})
			.on('close', save)
			.on('pin_button', function(evt, p, e){
				dialog.select(that.config['url-history-focus-on-pin'] ? p : '!') })
			.on('to_top_button', function(evt, p, e){
				to_sort.splice(0, 0, p) })

			// handle 'O' button to browse path...
			dialog.browsePath = function(p){
				this.selected 
					&& that.browsePath(p || this.selected)
						.close(function(evt, reason){
							reason != 'reject'
								&& dialog.close(reason)
						}) }
			dialog.keyboard.handler('General', 'O', 'browsePath')

			return dialog
		})],
	/*/ XXX
	listURLHistoryPinned: ['History|File/Location history (pinned)...',
		'listURLHistoryPinned: "pinned"'],
	//*/
})

var URLHistoryUI = 
module.URLHistoryUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-url-history',
	depends: [
		'ui',
		'url-history',
	],
	actions: URLHistoryUIActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
