/**********************************************************************
* 
*
*
**********************************************************************/

var requirejs_cfg = {
	baseUrl: 
		// electron...
		// NOTE: on electron v7+ the default seems to be '../', a bug?
		typeof(process) != 'undefined' && 'electron' in process.versions ?
			document.baseURI
				.replace(/^[a-zA-Z]+:\/\/\/?/, '')
				.split(/[#&]/)[0].split(/[\\\/]/g).slice(0, -1).join('/')
		: './',

	// XXX this does not work on direct filesystem access...
	//urlArgs: 'bust='+Date.now(),
	
	paths: {
		text: 'node_modules/requirejs-plugins/lib/text',
		json: 'node_modules/requirejs-plugins/src/json',
		
		//react: 'node_modules/react/dist/react-with-addons.min.js',
		//'react-dom': 'node_modules/react-dom/dist/react-dom.min.js',
		//'ext-lib/preact': './node_modules/preact/dist/preact.dev',

		'lib/object': 'node_modules/ig-object/object',
		'lib/types': 'node_modules/ig-types/',
		'lib/actions': 'node_modules/ig-actions/actions',
		'lib/features': 'node_modules/ig-features/features',
		//'lib/keyboard': './node_modules/ig-keyboard/keyboard',
		'object-run': 'node_modules/object-run/run',
		
		'lib/argv': 'node_modules/ig-argv/argv',
		'lib/walk': 'node_modules/generic-walk/walk',
	},	
	map: {
		'*': {
			// back-refs
			// ...these enable the npm modules reference each other in 
			// a cross-platform manner....
			'ig-object': 'lib/object',
			'ig-types': 'lib/types',
			'ig-actions': 'lib/actions',
			'ig-features': 'lib/features',

			//'ig-keyboard': 'lib/keyboard',

			'ig-argv': 'lib/argv',
			'generic-walk': 'lib/walk',
		},
	},
	packages: [
		'lib/types',
	],
}


if(typeof(require) != 'undefined'){
	requirejs_cfg.nodeRequire = require
	//requirejs_cfg.baseUrl = __dirname
}


// XXX revise...
if(typeof(require) != 'undefined' && typeof(global) != 'undefined'){
	global.requirejs = global.requirejs || require('requirejs')
}


requirejs.config(requirejs_cfg)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
