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
		'progress-fade-duration': 200,
		'progress-done-delay': 1000,

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
	// XXX make the "X" bigger -- finger usable...
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
	
	
		`,
		function(text, value, max, attrs){
			var that = this
			var viewer = this.dom

			// get attrs...
			var args = [...arguments]
			attrs = args.slice(1).last() instanceof Object ?
				args.pop()
				: null
			;[text, value, max] = args

			var msg = text instanceof Array ? text.slice(1).join(': ') : null
			text = text instanceof Array ? text[0] : text

			// cache -- make sure we do not update too often...
			if(value != 'close'){
				var cache = (this.__progress_cache = this.__progress_cache || {})
				cache = cache[text] = 
					Object.assign(
						cache[text] || {},
						attrs || {})

				var updateValue = function(name, value){
					var v = cache[name] || 0
					return (cache[name] = 
						value != null ? 
							((typeof(value) == typeof('str') 
									&& /[+-][0-9]+/.test(value)) ? 
								v + parseInt(value)
								: parseInt(value))
							: v) }

				value = updateValue('value', value)
				max = updateValue('max', max)

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
						$(this)
							.fadeOut(that.config['progress-fade-duration'] || 200, function(){
								var cache = (that.__progress_cache || {})[text]
								cache.timeout 
									&& clearTimeout(cache.timeout)
								cache.ondone
									&& cache.ondone()
								// clear cache...
								delete (that.__progress_cache || {})[text]
								$(this).remove() }) 
						widget = null })
					.appendTo(container)
				: widget

			// reset closing timeout...
			var timeout = widget.attr('close-timeout')
			timeout 
				&& clearTimeout(JSON.parse(timeout))

			// format the message...
			msg = msg ? ': '+msg : ''
			msg = ' '+ msg 
				+ (value && value >= (max || 0) ? ' (done)' 
					: max && value != max ? ' ('+ (value || 0) +' of '+ max +')'
					: '...')

			// update widget...
			widget.find('progress')
				.attr({
					value: value || '',
					max: max || '',
				})
			widget.find('.progress-details')
				.text(msg)

			// auto-close...
			if(value != null && value >= (max || 0)){
				widget.attr('close-timeout', 
					JSON.stringify(setTimeout(
						function(){ 
							widget
								&& widget.trigger('progressClose') }, 
						this.config['progress-done-delay'] || 1000))) } }],

	// handle logger progress...
	// XXX revise...
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
				this.showProgress(path, 0, 0, attrs)
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
