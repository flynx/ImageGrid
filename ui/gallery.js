

(function($){

	// globals...
	var current

	// init...
	$(function(){
	})	

	// actions:
	// NOTE: all actions other that .focus operate on the current image...
	//
	// navigation actions:
	// focus...
	function focus(img){
		// set image as current...
		// XXX
		// shift to focus ribbon...
		// XXX
		// center everything...
		centerRibbons()
	}

	// next...
	function focusNext(){
		// set current image to next...
		// XXX
		// center ribbon...
		centerRibbons()
	}

	// prev...
	function focusPrev(){
		// set current image to prev...
		// XXX
		// center ribbon...
		centerRibbons()
	}

	// shift up...
	function shiftUp(){
		// check if we can shift...
		if(isUpperRibbonEmpty()){
			return false
		}
		// shift the ribbon stack...
		// XXX
		// change ribbod class to current... (do the zooming in CSS)
		// XXX
	}

	// shift down...
	function shiftDown(){
		// check if we can shift...
		if(isLowerRibbonEmpty()){
			return false
		}
		// shift the ribbon stack...
		// XXX
		// change ribbod class to current... (do the zooming in CSS)
		// XXX
	}

	// toggle single view and ribbon view...
	function toggleRibbon(){
		// hide all elements other that the current image...
		// XXX
		// fit current image to screen...
		// XXX
	}

	// editint actions:
	// select / promote... (move toward / down)
	function promote(){
		// XXX
		centerRibbons()
	}

	// reject / demote... (move away / up)
	function demote(){
		// XXX
		centerRibbons()
	}

	// create an empty ribbon...
	function createRibbonAbove(){
		// XXX
	}
	function createRibbonBelow(){
		// XXX
	}
	

	// predicates...
	function isLowerRibbonEmpty(){
		// XXX
	}
	function isUpperRibbonEmpty(){
		// XXX
	}

	// heplers:
	// center the ribbon on the current image...
	// NOTE: should also position the upper and lower ribbons relative to the current...
	function centerRibbons(){
		// XXX
	}


})

// vim:set ts=4 sw=4 :
