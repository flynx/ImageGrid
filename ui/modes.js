/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// XXX make this save and restore settings...
var toggleSingleImageMode = createCSSClassToggler('.viewer', 
		'single-image-mode',
		function(action){
			if(action == 'on'){
				TRANSITION_MODE_DEFAULT = 'css'
				fitNImages(1)
			} else {
				TRANSITION_MODE_DEFAULT = 'animate'
				toggleImageProportions('square')
				fitNImages(5)
			}
		})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
