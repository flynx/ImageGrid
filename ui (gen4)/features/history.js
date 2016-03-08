/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')

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
	// NOTE: last opened url is last...
	// NOTE: though functions are supported they are not recommended as
	// 		we can not stringify them to JSON...
	get url_history(){
		return this.hasOwnProperty('__url_history') ? this.__url_history : undefined
	},
	set url_history(value){
		this.__url_history = value
	},


	clone: [function(full){
		return function(res){
			res.url_history = null
			if(full && this.url_history){
				res.url_history = JSON.parse(JSON.stringify(this.url_history))
			}
		}
	}],

	setTopURLHistory: ['- History/',
		function(url){
			var data = this.url_history[url]

			if(data == null){
				return
			}

			delete this.url_history[url]
			this.url_history[url] = data
		}],
	pushURLToHistory: ['- History/',
		function(url, open, check){
			var l = this.config['url-history-length'] || -1

			if(l == 0){
				return
			}

			url = url || this.location.path
			open = open || this.location.method
			check = check || 'checkPath'

			this.url_history = this.url_history || {}

			// remove the old value...
			if(url in this.url_history && this.config['url-history-push-up-on-open']){
				delete this.url_history[url]
			}

			// push url to history...
			this.url_history[url] = {
				open: open,
				check: check,
			}

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
		['start',
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
		'url-history-push-to-top-on-save': false,
	},

	handlers: [
		['saveIndex',
			function(){ 
				// push saved to top...
				if(this.config['url-history-push-to-top-on-save']){
					this.pushURLToHistory()

				// update...
				} else {
					var l = this.location
					var e = this.url_history[l.path]
					if(e != null){
						e.open = l.method
						this.saveURLHistory()

					} else {
						this.pushURLToHistory()
					}
				}
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
		'url-history-list-clear': ['open', 'close'],
	},
	// XXX make availabilyty checking live (now on open dialog)...
	// XXX need to check items...
	// XXX use svg icons for buttons...
	listURLHistory: ['History|File/Show history',
		function(){
			var that = this
			var parent = this.preventClosing ? this.preventClosing() : null
			var cur = this.location.path

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

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(
						null, 
						Object.keys(this.url_history)
							.reverse()
							// NOTE: this might get a little slow for 
							// 		very large sets...
							.map(function(p){
								return !that.checkURLFromHistory(p) ? 
									'- ' + p 
									: p 
							}),
						{
							// add item buttons...
							itemButtons: [
								// move to top...
								['&diams;', 
									function(p){
										var top = this.filter('*', false).first()
										var cur = this.filter('"'+p+'"', false)

										console.log('!!!', p)

										if(!top.is(cur)){
											top.before(cur)
											that.setTopURLHistory(p)
										}
									}],
								// mark for removal...
								['&times;', 
									function(p){
										var e = this.filter('"'+p+'"', false)
											.toggleClass('strike-out')

										if(e.hasClass('strike-out')){
											to_remove.indexOf(p) < 0 
												&& to_remove.push(p)

										} else {
											var i = to_remove.indexOf(p)
											if(i >= 0){
												to_remove.splice(i, 1)
											}
										}
									}],
							],
						})
					.open(function(evt, path){ 
						removeStriked('open')

						o.close() 

						// close the parent ui...
						parent 
							&& parent.close 
							&& parent.close()

						that.openURLFromHistory(path)
					}))
				.close(function(){
					removeStriked('close')

					parent 
						&& parent.focus 
						&& parent.focus()
				})

			var list = o.client

			/*
			Object.keys(this.url_history).reverse().forEach(function(p){
				that.checkURLFromHistory(p) || list.filter(p).addClass('disabled')
			})
			*/

			// select and highlight current path...
			cur && list
				.select('"'+ cur +'"')
					.addClass('highlighted')

			return o
		}],
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
* vim:set ts=4 sw=4 :                                                */
return module })
