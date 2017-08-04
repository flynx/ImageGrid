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
		['alias',
			function(_, alias, target){
				console.log(alias, target)
				// remove alias...
				if(target === null || target === false){
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
