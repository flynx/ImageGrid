/*********************************************************************/
// NOTE: use String.fromCharCode(code)...
var keybindings = {
	// togglable modes and options...
	//191: 	toggleHelp,										//	?
	70:		ImageGrid.toggleSingleImageMode,				//	f
	83:		ImageGrid.toggleSingleRibbonMode,				//	s
	13:		70,												//	Enter
	84:		ImageGrid.toggleSingleImageModeTransitions,		//	t
	65:		ImageGrid.toggleTransitions,					//	a
	9:		ImageGrid.toggleControls,						//	tab
	66:		toggleBackgroundModes,							//	b
	77:		toggleMarkers,									//	m


	// zooming...
	187:	function(){scaleContainerBy(ImageGrid.option.ZOOM_FACTOR)},		//	+
	189:	function(){scaleContainerBy(1/ImageGrid.option.ZOOM_FACTOR)},	//	-
	// zoom presets...
	48:	{
		'default':	fitImage,								// 	0
		'ctrl':		function(){setContainerScale(1)},		//	ctrl+0
	},
	51:		fitThreeImages,									//	3


	// navigation...
	36:		firstImage,										//	Home
	35:		lastImage,										//	End
	37:	{
		'default': prevImage,								//	Right
		'ctrl': prevScreenImages,							//	ctrl-Right
		'alt': prevScreenImages,							//	alt-Right
	},
	80: 	37, 											// 	BkSp
	188:	37, 											//	p
	8:		37,												//	<
	39:	{
		'default': nextImage,								//	Left
		'ctrl': nextScreenImages,							//	ctrl-Left
		'alt': nextScreenImages,							//	alt-Left
	},
	32:		39,												//	Space
	190:	39,												//	m
	78: 	39,												//	>
	// move view...
	// XXX should these be s-up, s-down, ... ??
	75:		moveViewUp,										//	k
	74:		moveViewDown,									//	j
	72:		moveViewLeft,									//	h
	76:		moveViewRight,									//	l
	79:		centerCurrentImage,								//	o


	// combined navigation with actions..
	40:	{
		'default': focusBelowRibbon,						//	Down
		'shift': shiftImageDown,							//	shift-Down
		'ctrl+shift': function(){							//	ctrl-shift-Down
			createRibbon('next')
			shiftImageDown()
		}
	},
	38: {
		'default': focusAboveRibbon,						//	Up
		'shift': shiftImageUp,								//	shift-Up
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
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :
