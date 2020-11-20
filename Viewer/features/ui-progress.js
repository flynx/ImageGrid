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

		// NOTE: each root key is also is also usable as a keyword.
		'progress-keywords': {
			add: [
				'added',
				'queued',
				'found',
			],
			done: [
				'loaded',
				'written',
				'index',
			],
			skip: [
				'skipped',
				'skipping',
				'removed',
			],
			close: [
				'end',
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

			// make sure we do not update too often...
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
							(typeof(value) == typeof('str') && /[+-][0-9]+/.test(value) ? 
								v + parseInt(value)
								: parseInt(value))
							: v) }

				value = updateValue('value', value)
				max = updateValue('max', max)

				// update not due yet...
				if('timeout' in cache){
					cache.update = true
					return 

				// set next update point and continue...
				} else {
					delete cache.update
					cache.timeout = setTimeout(
						function(){
							var cache = that.__progress_cache[text] || {}
							delete cache.timeout
							cache.update
								&& that.showProgress(text) }, 
						this.config['progress-update-min'] || 200) } }

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

			widget = widget.length == 0 ?
				$('<div/>')
					.addClass('progress-bar')
					.attr('name', text)
					.text(text)
					// close button...
					.append($('<span class="close">&times;</span>')
						.on('click', function(){ 
							var cache = (that.__progress_cache || {})[text]
							// XXX do we need both close and done callbacks???
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
						widget
							.fadeOut(that.config['progress-fade-duration'] || 200, function(){
								var cache = (that.__progress_cache || {})[text]
								cache.timeout 
									&& clearTimeout(cache.timeout)
								// XXX do we need both close and done callbacks???
								cache.ondone
									&& cache.ondone()
								delete (that.__progress_cache || {})[text]
								$(this).remove() }) })
					.appendTo(container)
				: widget

			// reset closing timeout...
			var timeout = widget.attr('close-timeout')
			timeout && clearTimeout(JSON.parse(timeout))

			// get the widget parts we are updating...
			var bar = widget.find('progress')
			var state = widget.find('.progress-details')

			// format the message...
			msg = msg ? ': '+msg : ''
			msg = ' '+ msg 
				+ (value && value >= (max || 0) ? ' (done)' 
					: max && value != max ? ' ('+ (value || 0) +' of '+ max +')'
					: '...')

			// update widget...
			bar.attr({
				value: value || '',
				max: max || '',
			})
			state.text(msg)

			// auto-close...
			if(value && value >= (max || 0)){
				widget.attr('close-timeout', 
					// XXX BUG: this appears to get triggered after we close progress...
					JSON.stringify(setTimeout(function(){ 
						widget.trigger('progressClose') 
					}, this.config['progress-done-delay'] || 1000))) }

			// XXX force the browser to render...
			//bar.hide(0).show(0)
		}],

	// handle logger progress...
	// XXX revise...
	handleLogItem: ['- System/',
		function(logger, path, status, ...rest){
			var msg = path.join(': ')
			var l = (rest.length == 1 && rest[0] instanceof Array) ?
				rest[0].length
				: rest.length

			// get keywords...
			var {add, done, skip, close, error} = 
				this.config['progress-keywords'] 
				|| {}
			// setup defaults...
			add = new Set([...(add || []), 'added'])
			done = new Set([...(done || [])])
			skip = new Set([...(skip || []), 'skipped'])
			close = new Set([...(close || []), 'closed'])
			error = new Set([...(error || [])])

			// close...
			if(status == 'close' || close.has(status)){
				this.showProgress(path, 'close', logger)

			// added new item -- increase max...
			// XXX show msg in the progress bar...
			} else if(status == 'add' || add.has(status)){
				this.showProgress(path, '+0', '+'+l, logger)

			// resolved item -- increase done... 
			} else if(status == 'done' || done.has(status)){
				this.showProgress(path, '+'+l, logger)

			// skipped item -- increase done... 
			// XXX should we instead decrease max here???
			// 		...if not this is the same as done -- merge...
			} else if(status == 'skip' || skip.has(status)){
				this.showProgress(path, '+'+l, logger)

			// error...
			// XXX STUB...
			} else if(status == 'error' || error.has(status)){
				this.showProgress(['Error'].concat(msg), '+0', '+'+l, logger)
			}
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
