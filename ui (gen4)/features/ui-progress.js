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
	//
	// XXX add message to be shown...
	// XXX should we report errors and stoppages??? (error state??)
	// XXX multiple containers...
	// XXX shorten the nested css class names...
	// XXX revise styles...
	showProgress: ['- Interface/Show progress bar...',
		function(text, value, max){
			var viewer = this.dom
			var that = this

			var msg = text instanceof Array ? text.slice(1).join(': ') : null
			text = text instanceof Array ? text[0] : text

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
				return
			}
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
								$(this).remove() }) })
					.appendTo(container)
				: widget

			// reset closing timeout...
			var timeout = widget.attr('close-timeout')
			timeout && clearTimeout(JSON.parse(timeout))

			// get the widget parts we are updating...
			var bar = widget.find('progress')
			var state = widget.find('.progress-details')

			// XXX stub???
			// normalize max and value...
			max = max != null ? 
					(typeof(max) == typeof('str') && /[+-][0-9]+/.test(max) ? 
						parseInt(bar.attr('max') || 0) + parseInt(max)
					: parseInt(max))
				: bar.attr('max')
			value = value != null ? 
					(typeof(value) == typeof('str') && /[+-][0-9]+/.test(value) ? 
						parseInt(bar.attr('value') || 0) + parseInt(value)
					: parseInt(value))
				: bar.attr('value')

			// format the message...
			// XXX should we add a message after this????
			msg = msg ? ': '+msg : ''
			msg = ' '+ msg 
				//+ (value && value >= (max || 0) ? ' ('+value+' done)' 
				+ (value && value >= (max || 0) ? ' (done)' 
					: value && max && value != max ? ' ('+ value +' of '+ max +')'
					: '...')

			// update widget...
			bar.attr({
				value: value || '',
				max: max || '',
			})
			state.text(msg)

			// auto-close...
			// XXX make this optional... 
			if(value && value >= (max || 0)){
				widget.attr('close-timeout', 
					JSON.stringify(setTimeout(function(){ 
						widget.trigger('progressClose') 
					}, this.config['progress-done-delay'] || 1000)))
			}

			// XXX force the browser to render...
			//bar.hide(0).show(0)

			// XXX what should we return??? (state, self, controller?)
		}],

	// handle logger progress...
	// XXX revise...
	handleLogItem: ['- System/',
		function(path, status, ...rest){
			var msg = this.message

			// report progress...
			// XXX HACK -- need meaningful status...
			if(status == 'queued' 
					|| status == 'found'){
				this.showProgress(msg || ['Progress', status], '+0', '+'+rest.length)

			} else if(status == 'loaded' || status == 'done' || status == 'written' 
					|| status == 'index'){
				this.showProgress(msg || ['Progress', status], '+'+rest.length)

			} else if(status == 'skipping' || status == 'skipped'){
				// XXX if everything is skipped the indicator does not 
				// 		get hidden...
				//this.showProgress(msg || ['Progress', status], '+0', '-1')
				this.showProgress(msg || ['Progress', status], '+'+rest.length)

			// XXX STUB...
			} else if(status == 'error' ){
				this.showProgress(['Error'].concat(msg), '+0', '+'+rest.length)
				//console.log(msg ? 
				//	'    '+ msg.join(': ') + ':' 
				//	: '', ...arguments) 
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
