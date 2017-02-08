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
	pushURLToHistory: ['- History/',
		function(url, open, check, clear){
			url = url || this.location.path
			var l = this.config['url-history-length'] || -1

			if(l == 0){
				return
			}

			this.url_history = this.url_history || {}
			var item = !clear ? (this.url_history[url] || {}) : {}

			open = item.open = open || this.location.method
			check = item.check = check || 'checkPath'

			// remove the old value...
			if(url in this.url_history && this.config['url-history-push-up-on-open']){
				delete this.url_history[url]
			}

			// push url to history...
			this.url_history[url] = item
			/*this.url_history[url] = {
				open: open,
				check: check,
			}*/

			// update history length...
			if(l > 0){
				var k = Object.keys(this.url_history)
				while(k.length > l){
					// drop first url in order -- last added...
					this.dropURLFromHistory(k[0])
					var k = Object.keys(this.url_history)
				}
			}
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

				if(typeof(check) == typeof('str')){
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
			.pinURLOrder(<url>)
				-> order

			Set pin order...
			.pinURLOrder(<url>, <order>)
				-> this

			Set pin order to 'auto'...
			.pinURLOrder(<url>, 'auto')
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

	saveURLHistory: ['History/',
		function(){
			var history = this.config['url-history-local-storage-key']
			if(history != null){
				localStorage[history] = 
					JSON.stringify(this.url_history) 
			}

			this.saveLocation()
		}],
	saveLocation: ['History/',
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

				this.openURLFromHistory(l.path, l.method)

			} else {
				this.openURLFromHistory(0)
			}
		}]
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
			function(){ this.loadLastSavedBasePath() }], 

		['stop.pre',
			function(){ this.saveURLHistory() }], 

		// save base_path...
		['load', 
			function(){ this.location && this.location.path && this.saveLocation() }],

		// save...
		['pushURLToHistory dropURLFromHistory setTopURLHistory', 
			function(){ 
				this.saveURLHistory()
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
						that.pushURLToHistory(l.path, l.method)

					// update...
					} else {
						var e = that.url_history[l.path]
						if(e != null){
							e.open = l.method
							that.saveURLHistory()

						} else {
							that.pushURLToHistory(l.path, l.method)
						}
					}
				})
			}], 
	],
})



//---------------------------------------------------------------------

var URLHistoryUIActions = actions.Actions({
	config: {
		// Indicate when to remove striked items from url history list
		//
		// Supported values:
		// 	- true | undefined		- always remove
		// 	- flase					- never remove
		// 	- [ 'open', 'close' ]	- explicitly select event
		//
		// XXX do we need this???
		'url-history-list-clear': ['open', 'close'],

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

	listURLHistoryOld: ['History|File/Location history (old)...',
		widgets.makeUIDialog(function(){
			var that = this
			var parent = this.preventClosing ? this.preventClosing() : null
			var cur = this.location.path

			// caches...
			var fs_state = {}
			var to_remove = []

			// remove stirked out elements...
			var removeStriked = function(evt){
				var rem = that.config['url-history-list-clear']
				if(rem == false || rem != null && rem.indexOf(evt) < 0){
					return
				}
				to_remove.forEach(function(e){
					that.dropURLFromHistory(e)
				})
				to_remove = []
			}
			var makeHistoryList = function(fs_state){
				fs_state = fs_state || {}
				var history = Object.keys(that.url_history).reverse()

				// pinned items...
				var list = history
					.filter(function(p){
						// NOTE: yes direct access is faster, but 
						// 		calling the toggler (common API) here
						// 		will isolate the level knowledge to a
						// 		single point which will simplify things
						// 		if anything changes...
						//return that.url_history[p].pinned 
						return that.toggleURLPinned(p, '?') == 'on'
					}) 
					.map(function(p){
						// prevent from drawing again...
						history.splice(history.indexOf(p), 1)

						// see of we need a full refresh or use the 
						// last fs_state...
						if(p in fs_state){
							// XXX need to make this faster...
							var d = fs_state[p]

						} else {
							var d = !that.checkURLFromHistory(p)
							fs_state[p] = d
						}

						return [p,
							[p == cur ? 'highlighted selected': '', 'pinned'].join(' '),
							{ disabled: d }
						]
					})

				// separator...
				list.push([ '---', 'pinned-separator', {}])

				// history...
				list = list.concat(history 
					// NOTE: this might get a little slow for 
					// 		very large sets...
					.map(function(p){
						// see of we need a full refresh or use the 
						// last fs_state...
						if(p in fs_state){
							// XXX need to make this faster...
							var d = fs_state[p]

						} else {
							var d = !that.checkURLFromHistory(p)
							fs_state[p] = d
						}

						return [p, 
							p == cur ? 'highlighted selected': '',
							{disabled: d},
						]
					}))

				// history is empty...
				// NOTE: the length here is 1 because we need to account
				// 		for the separator...
				if(list.length == 1){
					list.push([
						'No history...', 
						{
							disabled: true, 
							buttons: [],
						}
					])
				}

				return list
			}


			// NOTE: this partially re-implements browse.Items.EditableList(..)
			// 		but since we have the pinned items we can't use it directly
			// 		...and since .EditableList(..) can't be used twice per 
			// 		dialog we can't work around this...
			var o = browse.makeLister(null, 
				function(path, make){
					makeHistoryList()
						.forEach(function(elem){
							var e = elem.slice()
							var path = e.shift()
							var cfg = e.pop()
							var cls = e.pop() || ''

							make(path, cfg)
								.attr('path', path)
								.addClass(cls)
						})
				},
				// add item buttons...
				{ itemButtons: [
					// open...
					['<span class="show-on-hover">&#8599;</span>', 
						function(p){ 
							o.browsePath(p) }],
					// move to top...
					//['<span class="show-on-hover">&diams;</span>', 
					['&diams;', 
						function(p){
							that.setTopURLHistory(p)
							o.redraw(p)
						}],
					// pin to top...
					// XXX should this be standard functionality???
					['<span class="pin-set">&#9679;</span>'
					+'<span class="pin-unset">&#9675;</span>', 
						function(p, cur){
							// change state...
							// pinned...
							if(cur.hasClass('pinned')){
								cur.removeClass('pinned')
								that.toggleURLPinned(p, 'off')

							// not pinned...
							} else {
								cur.addClass('pinned')
								that.toggleURLPinned(p, 'on')
							}

							// focus...
							that.config['url-history-focus-on-pin']
								&& o.select(cur)

							// place...
							o.redraw()
						}],
					// mark for removal...
					browse.buttons.markForRemoval(to_remove) 
				] })
				.open(function(evt, path){ 
					removeStriked('open')

					o.close() 

					that.openURLFromHistory(path)
				})
				.on('close', function(){
					removeStriked('close')
				})

			// Monkey-patch: fast redraw...
			//
			// NOTE: this is substantially faster than calling .update()
			// 		because this will only change positions of a view dom 
			// 		elements while .update(..) will redraw the while thing...
			// NOTE: this also uses fs_state for caching...
			o.redraw = function(path){
				var list = o.dom.find('.list')
				makeHistoryList(fs_state)
					.forEach(function(elem, i){
						if(path && path != elem[0]){
							return
						}
						// move...
						if(list.children().eq(i).attr('path') != elem[0]){
							list.children().eq(i)
								.before(list
									.find('[path="'+elem[0]+'"]'))
						}
					})
		   		return this
			}

			// handle 'O' button to browse path...
			o.browsePath = function(p){
				that.browsePath(p || this.selected)
					.close(function(evt, reason){
						reason != 'reject'
							&& o.close(reason)
					}) }
			o.keyboard.handler('General', 'O', 'browsePath')

			return o
		})],

	// XXX add option to force full update on dialog.update() (???)
	listURLHistory: ['History|File/Location history...',
		widgets.makeUIDialog(function(){
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
				that.sortURLHistory(to_sort)
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
				// NOTE: we are not using path: here because it will parse
				// 		the current element as a path, and we need it as-is... 
				selected: cur,
			})
			.open(function(evt, path){ 
				save()
				dialog.close() 
				that.openURLFromHistory(path)
			})
			.on('close', function(){
				save()
			})
			.on('to_top_button', function(evt, p, e){
				to_sort.splice(0, 0, p)
			})

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
