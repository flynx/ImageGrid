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

var core = require('features/core')



/*********************************************************************/

var Alias = 
module.Alias = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'alias',

	config: {
		//aliases: {
		//},
	},

	handlers: [
		// load aliases...
		['start',
			function(){
				var that = this
				var aliases = this.config.aliases || {}

				Object.keys(aliases)
					.forEach(function(alias){
						that.alias(alias, aliases[alias]) })
			}],
		// store aliases in .config.aliases
		// XXX should we guard from overriding actions???
		['alias',
			function(_, alias, target){
				// remove alias...
				// XXX is this test enough??? ...see ActionSet.alias(..)
				if(arguments.length == 3 
						&& (target === null || target === false)){
					var aliases = this.config.aliases || {}

					delete aliases[alias]

					if(Object.keys(alias).length == 0){
						delete this.config.aliases
					}

				// save alias...
				} else {
					var aliases = this.config.aliases = this.config.aliases || {}

					aliases[alias] = target
				}
			}]],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
