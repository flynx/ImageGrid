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
	},

	// Progress bar widget...
	//
	// 	Create progress bar...
	// 	.showProgress('text')
	//
	// 	Update progress bar (value, max, msg)...
	// 	.showProgress('text', 0, 10)
	// 	.showProgress('text', 10, 50, 'message')
	//
	// 	Update progress bar value (has no effect if max is not set)...
	// 	.showProgress('text', 10)
	//
	// 	Close progress bar...
	// 	.showProgress('text', 'close')
	//
	// 	Relative progress modification...
	// 	.showProgress('text', '+1')
	// 	.showProgress('text', '+0', '+1')
	//
	// 	.showProgress(logger)
	//
	//
	// XXX add message to be shown...
	// XXX should we report errors and stoppages??? (error state??)
	// XXX multiple containers...
	// XXX shorten the nested css class names...
	// XXX revise styles...
	__progress_cache: null,
	showProgress: ['- Interface/Show progress bar...',
		function(text, value, max){
			var that = this
			var viewer = this.dom

			var msg = text instanceof Array ? text.slice(1).join(': ') : null
			text = text instanceof Array ? text[0] : text

			// make sure we do not update too often...
			if(value != 'close'){
				var cache = (this.__progress_cache = this.__progress_cache || {})
				cache = cache[text] = cache[text] || {}

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
						.on('click', function(){ widget.trigger('progressClose') }))
					// state...
					.append($('<span/>')
						.addClass('progress-details'))
					// bar...
					.append($('<progress/>'))
					// events...
					.on('progressClose', function(){ 
						widget
							.fadeOut(that.config['progress-fade-duration'] || 200, function(){
								var cache = (that.__progress_cache || {})
								cache[text].timeout 
									&& clearTimeout(cache[text].timeout)
								delete cache[text]
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
					JSON.stringify(setTimeout(function(){ 
						widget.trigger('progressClose') 
					}, this.config['progress-done-delay'] || 1000))) }

			// XXX force the browser to render...
			//bar.hide(0).show(0)
		}],

	// handle logger progress...
	// XXX revise...
	handleLogItem: ['- System/',
		function(path, status, ...rest){
			var msg = path.join(': ')
			var l = (rest.length == 1 && rest[0] instanceof Array) ?
				rest[0].length
				: rest.length

			// XXX should we move these to a more accessible spot???
			var add = [
				'added',
				'queued',
				'found',
			]
			var done = [
				'loaded',
				'done',
				'written',
				'index',
			]
			var skipped = [
				'skipping',
				'skipped',
				'removed',
			]

			// report progress...
			// XXX HACK -- need meaningful status...
			if(add.includes(status)){
				this.showProgress(msg, '+0', '+'+l)

			} else if(done.includes(status)){
				this.showProgress(msg, '+'+l)

			} else if(skipped.includes(status)){
				// XXX if everything is skipped the indicator does not 
				// 		get hidden...
				this.showProgress(msg, '+'+l)

			// XXX STUB...
			} else if(status == 'error' ){
				this.showProgress(['Error'].concat(msg), '+0', '+'+l)
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
