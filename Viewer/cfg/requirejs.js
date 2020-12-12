/**********************************************************************
* 
*
*
* This can be loaded from two contexts:
*
* 	- <script src=../>
* 		Needs the requirejs module already loaded...
* 		Example:
* 			<script src="js/require.min.js"/>
* 			<script src="cfg/requirejs.js"/>
*
* 	- require(..)
* 		This needs the root require(..) function...
* 		Example:
* 			// in the root module...
* 			require('./cfg/requirejs.js')(require)
*
*
**********************************************************************/

var _requirejs = typeof(requirejs) != 'undefined' && requirejs


var setup = function(require){
	var res = {}
	var requirejs = _requirejs

	var requirejs_cfg = {
		// NOTE: this is really odd: running electron as a packed binary breaks
		// 		requirejs' paths...
		baseUrl: typeof(process) != 'undefined' 
					&& process.versions.electron ?
				(require.main ?
					require.main.filename.split(/[\\\/]/g).slice(0, -1).join('/')
					: document.baseURI
						.replace(/^[a-zA-Z]+:\/\/\/?/, '')
						.split(/[#&]/)[0].split(/[\\\/]/g).slice(0, -1).join('/'))
			:  '.',

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


	// node contexts...
	if(typeof(process) != 'undefined'){
		var nodeRequire = 
		requirejs_cfg.nodeRequire = 
			global.nodeRequire 
				|| global.require
				|| require

		require('app-module-path')
			.addPath('.')

		requirejs = 
		global.requirejs = 
		res.requirejs =
			global.requirejs 
				|| require('requirejs') 

		global.nodeRequire = 
		res.nodeRequire =
			nodeRequire }


	// browser contexts...
	if(typeof(window) != 'undefined'){
		window.nodeRequire = 
			window.nodeRequire 
				|| (typeof(require) != 'undefined' 
					&& require !== requirejs
					&& require) 
		window.requirejs = requirejs }

	requirejs.config(requirejs_cfg)

	return res }



//---------------------------------------------------------------------
// Run/export the setup...
//
// we can get here from two contexts...
typeof(process) == 'undefined' ?
	// browser's <script src="..">...
	setup(require)
	// node's require(..)
	: (module.exports = setup)




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
