/*********************************************************************/
// NOTE: use String.fromCharCode(code)...
var keybindings = {
	// togglable modes and options...
	191: 	ImageGrid.showSetup,										//	?
	70:		ImageGrid.toggleSingleImageMode,				//	f
	83:		ImageGrid.toggleSingleRibbonMode,				//	s
	13:		70,												//	Enter
	84:		ImageGrid.toggleSingleImageModeTransitions,		//	t
	65:		ImageGrid.toggleTransitions,					//	a
	9:		ImageGrid.toggleControls,						//	tab
	66:		toggleBackgroundModes,							//	b
	77:		toggleMarkers,									//	m


	27:	[
		// XXX make this into a real action...
		function(){$('.overlay').click()},					//	Esc
		'Hide overlay'
	],

	// zooming...
	// XXX make this into a real action...
	187:	function(){scaleContainerBy(ImageGrid.option.ZOOM_FACTOR)},		//	+
	// XXX make this into a real action...
	189:	function(){scaleContainerBy(1/ImageGrid.option.ZOOM_FACTOR)},	//	-
	// zoom presets...
	48:	{
		'default':	fitImage,								// 	0
		// XXX make this into a real action...
		'ctrl':		function(){setContainerScale(1)},		//	ctrl+0
	},
	49:		fitImage,										//	1
	50:		fitTwoImages,									//	2
	51:		fitThreeImages,									//	3
	52:		fitFourImages,									//	4
	53:		fitFiveImages,									//	5
	54:		fitSixImages,									//	6
	55:		fitSevenImages,									//	7
	56:		fitEightImages,									//	8
	57:		fitNineImages,									//	9


	// navigation...
	36:		ImageGrid.firstImage,							//	Home
	35:		ImageGrid.lastImage,							//	End
	37:	{
		'default': ImageGrid.prevImage,						//	Right
		'ctrl': ImageGrid.prevScreenImages,					//	ctrl-Right
		'alt': ImageGrid.prevScreenImages,					//	alt-Right
	},
	80: 	37, 											// 	BkSp
	188:	37, 											//	p
	8:		37,												//	<
	39:	{
		'default': ImageGrid.nextImage,						//	Left
		'ctrl': ImageGrid.nextScreenImages,					//	ctrl-Left
		'alt': ImageGrid.nextScreenImages,					//	alt-Left
	},
	32:		39,												//	Space
	190:	39,												//	m
	78: 	39,												//	>
	// move view...
	// XXX should these be s-up, s-down, ... ??
	75:		ImageGrid.moveViewUp,							//	k
	74:		ImageGrid.moveViewDown,							//	j
	72:		ImageGrid.moveViewLeft,							//	h
	76:		ImageGrid.moveViewRight,						//	l
	79:		ImageGrid.centerCurrentImage,					//	o


	// combined navigation with actions..
	40:	{
		'default': ImageGrid.focusBelowRibbon,				//	Down
		'shift': shiftImageDown,							//	shift-Down
		// XXX make this into a real action...
		'ctrl+shift': function(){							//	ctrl-shift-Down
			createRibbon('next')
			shiftImageDown()
		}
	},
	38: {
		'default': ImageGrid.focusAboveRibbon,				//	Up
		'shift': shiftImageUp,								//	shift-Up
		// XXX make this into a real action...
		'ctrl+shift': function(){							//	ctrl-shift-Up
			createRibbon('prev')
			shiftImageUp()
		}
	},


	// ignore the modifiers (shift, alt, ctrl, caps)...
	16:		function(){},
	17:		16,
	18:		16,
	20:		16,												// Caps Lock

	// refresh...
	// XXX make this into a real action...
	116:	function(){ return DEBUG?true:false }			// F5
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
