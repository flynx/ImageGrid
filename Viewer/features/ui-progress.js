/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var ProgressActions = actions.Actions({
	config: {
		'progress-pre-delay': 1000,
		'progress-done-delay': 1000,
		'progress-fade-duration': 200,

		'progress-update-min': 200,

		// Logger keywords / aliases that trigger progress actions...
		//
		// The builtin keywords / aliases are:
		// 	add / added			- add one or more item to progress bar
		// 	done				- move the progress bar by 1
		// 	skip / skipped		- move the progress bar by 1
		// 	close / closed		- close the progress bar
		// 	error				- report error
		//
		// The progress bar will be created on first 'add' call.
		//
		// The progress bar will be closed when the number of added items
		// is less or equal to the number of done or skipped items.
		//
		//
		// For example:
		//		var log = logger.push('Example')	// - define a logger...
		// 		log.emit('add', 'some item...')		// - creates a progress bar
		// 											//   with one item...
		// 		log.emit('add', [ ... ])			// - adds multiple items to
		// 											//   progress bar...
		// 		...
		//		log.emit('done', 'some item...')	// - close the progress bar
		//		...
		//
		//
		// Format:
		// 	{
		// 		<keyword>: [
		// 			<alias>,
		// 			...
		// 		],
		// 		...
		// 	}
		//
		//
		// NOTE: the builtin aliases will work even if this is empty.
		// NOTE: each root key is also is also usable as a keyword.
		'progress-logger-keywords': {
			add: [
				'queued',
				'found',
			],
			done: [
				'loaded',
				'written',
				'index',
			],
			skip: [
				'skipping',
				'removed',
			],
			reset: [
				'clear',
			],
			close: [
				'end',
				'abort',
			],
			error: [
			],
		},
	},


	// XXX add message to be shown...
	// XXX should we report errors and stoppages??? (error state??)
	// XXX multiple containers...
	// XXX shorten the nested css class names...
	// XXX revise styles...
	// XXX make the "X" finger usable...
	// XXX add time estimation...
	// 		....based on last 10 tasks...
	__progress_cache: null,
	showProgress: ['- Interface/Show progress bar...',
		core.doc`Progress bar widget...
	
			Create progress bar...
			.showProgress('text')
		
			Update progress bar (value, max, msg)...
			.showProgress('text', 0, 10)
			.showProgress('text', 10, 50, 'message')
		
			Update progress bar value (has no effect if max is not set)...
			.showProgress('text', 10)
		
			Close progress bar...
			.showProgress('text', 'close')

			Relative progress modification...
			.showProgress('text', '+1')
			.showProgress('text', '+0', '+1')
		
			.showProgress(logger)
	

		The progress bar is going to be shown to the user if:
			- max is greater than 1, or
			- it did not close before .config['progress-pre-delay'] ms of start
		This is done to avoid spamming the user with single point progress bars.


		NOTE: to force show the progress bar set attrs.forceShow to true.
		`,
		function(text, value, max, attrs){
			var that = this
			var viewer = this.dom

			// get attrs...
			var args = [...arguments]
			attrs = args.last() instanceof Object ?
				args.pop()
				: null
			var forceShow = !!(attrs || {}).forceShow
			;[text, value, max] = args

			// XXX revise...
			var msg = 
				(text instanceof Array 
						&& text.length > 1) ? 
					text.slice(1).join(': ') 
					: null
			text = text instanceof Array ? 
				text[0] 
				: text

			// reset -- clear cache and set everything to 0...
			// NOTE: we will later draw the progress bar full...
			var reset = value == 'reset'
			if(reset){
				delete (this.__progress_cache || {})[text]
				value = 0
				max = 0 }

			// cache -- make sure we do not update too often...
			if(value != 'close'){
				var cache = (this.__progress_cache = this.__progress_cache || {})
				cache = cache[text] = 
					Object.assign(
						{msg},
						cache[text] || {msg},
						attrs || {})
				// restore cached message if none given...
				msg = cache.msg = msg || cache.msg

				var updateValue = function(name, value){
					var v = cache[name] || 0
					return (cache[name] = 
						value != null ? 
							((typeof(value) == typeof('str') 
									&& /[+-][0-9]+/.test(value)) ? 
								v + parseInt(value)
								: parseInt(value))
							: v) }

				var prev = cache.prev || 0
				value = cache.prev = updateValue('value', value)
				max = updateValue('max', max)

				// estimate time to completion...
				var t0 = cache.timestamp || Date.now()
				var t = (cache.timestamp = Date.now()) - t0
				var avg = cache.avg_time = 
					// rolling average -- feels a bit too smooth...
					(((cache.avg_time || 0) * prev + t) / value) || 0
				var remaining = new Date(0)
				avg > 0
					&& remaining.setMilliseconds(
						avg 
							* (max-value) 
							// make the estimate a bit pessimistic...
							* 1.3)

				// update not due yet...
				if('timeout' in cache){
					cache.update = true
					return }

				// set next update point and continue...
				delete cache.update
				cache.timeout = setTimeout(
					function(){
						var cache = that.__progress_cache[text] || {}
						delete cache.timeout
						cache.update
							&& that.showProgress(text) }, 
					this.config['progress-update-min'] || 200) }

			// container...
			var container = viewer.find('.progress-container')
			container = container.length == 0 ?
				$('<div/>')
					.addClass('progress-container')
					.appendTo(viewer)
				: container

			// widget...
			var widget = container.find('.progress-bar[name="'+text+'"]')

			// close action...
			if(value == 'close'){
				widget.trigger('progressClose')
				return }

			// create if not done yet...
			widget = widget.length == 0 ?
				$('<div/>')
					.addClass('progress-bar')
					.css({
						display: 'none',
					})
					.attr('name', text)
					.text(text)
					// close button...
					.append($('<span class="close">&times;</span>')
						.on('click', function(){ 
							var cache = (that.__progress_cache || {})[text]
							cache.onclose
								&& cache.onclose() 
							widget.trigger('progressClose') }))
					// state...
					.append($('<span/>')
						.addClass('progress-details'))
					// bar...
					.append($('<progress/>'))
					// events...
					.on('progressClose', function(){ 
						var elem = $(this)

						var clear = function(){
							var cache = (that.__progress_cache || {})[text]
							cache.timeout 
								&& clearTimeout(cache.timeout)
							cache.ondone
								&& cache.ondone()
							// clear cache...
							delete (that.__progress_cache || {})[text]
							elem.remove() }

						// widget was not shown...
						if(elem.attr('closing') == null
								|| elem.css('display') == 'none'){
							clear()
						// fade...
						} else {
							elem[0].setAttribute('closing', '') 
							elem	
								.fadeOut(
									that.config['progress-fade-duration'] || 200, 
									clear) }
						widget = null })
					.appendTo(container)
				: widget
					.removeAttr('closing')

			// reset closing timeout...
			var timeout = widget.attr('close-timeout')
			timeout 
				&& clearTimeout(JSON.parse(timeout))

			// time remaining...
			// NOTE: we show hours only if > 0...
			var t = (remaining && remaining.valueOf()) ?
				` / -${ 
					remaining.toISOString()
						.substr(11, 8)
						.replace(/^00:(00:)?/, '') }s`
				: ''
			// format the message...
			msg = msg ? 
				': '+msg 
				: ''
			msg = ' '+ msg 
				+ (value && value >= (max || 0) ? 
						' (done)' 
					: max && value != max ? 
						` (${value || 0} of ${max}${t})`
					: '...')

			// update widget...
			reset ?
				// NOTE: on reset we show the progress bar full...
				widget.find('progress')
					.attr({ value: 1, max: 1 })
				: widget.find('progress')
					.attr({
						value: (value || ''),
						max: (max || ''),
					})
			widget.find('.progress-details')
				.text(msg)

			// auto-show...
			if(forceShow 
					|| max > 1 
					|| !this.config['progress-pre-delay']){
				widget.css({display: ''}) 
			} else {
				setTimeout(
					function(){ 
						widget
							&& widget.attr('closing') == undefined
							&& widget.css({display: ''}) }, 
					this.config['progress-pre-delay'] || 1000) }

			// auto-close...
			if(value != null && value >= (max || 0)){
				widget.attr('close-timeout', 
					JSON.stringify(setTimeout(
						function(){ 
							if(widget){
								widget.trigger('progressClose') } }, 
						this.config['progress-done-delay'] || 1000))) } }],

	// handle logger progress...
	handleLogItem: ['- System/',
		function(logger, path, status, ...rest){
			var msg = path.join(': ')
			var l = (rest.length == 1 && rest[0] instanceof Array) ?
				rest[0].length
				: rest.length

			// only pass the relevant stuff...
			var attrs = {}
			logger.ondone 
				&& (attrs.ondone = logger.ondone)
			logger.onclose 
				&& (attrs.onclose = logger.onclose)

			// get keywords...
			var {add, done, skip, reset, close, error} = 
				this.config['progress-logger-keywords'] 
				|| {}
			// setup default aliases...
			add = new Set([...(add || []), 'added'])
			done = new Set([...(done || [])])
			skip = new Set([...(skip || []), 'skipped'])
			reset = new Set([...(reset || [])])
			close = new Set([...(close || []), 'closed'])
			error = new Set([...(error || [])])

			// close...
			if(status == 'close' || close.has(status)){
				this.showProgress(path, 'close', attrs)
			// reset...
			} else if(status == 'reset' || reset.has(status)){
				this.showProgress(path, 'reset', attrs)
			// added new item -- increase max...
			// XXX show msg in the progress bar???
			} else if(status == 'add' || add.has(status)){
				this.showProgress(path, '+0', '+'+l, attrs)
			// resolved item -- increase done... 
			} else if(status == 'done' || done.has(status)){
				this.showProgress(path, '+'+l, attrs)
			// skipped item -- increase done... 
			// XXX should we instead decrease max here???
			// 		...if not this is the same as done -- merge...
			} else if(status == 'skip' || skip.has(status)){
				this.showProgress(path, '+'+l, attrs)
			// error...
			// XXX STUB...
			} else if(status == 'error' || error.has(status)){
				this.showProgress(['Error'].concat(msg), '+0', '+'+l, attrs) }
		}],
})

var Progress = 
module.Progress = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-progress',
	depends: [
		'ui',
	],

	actions: ProgressActions, 
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
