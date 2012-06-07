(function($)
{
	// This script was written by Steve Fenton
	// http://www.stevefenton.co.uk/Content/Jquery-Gestures/
	// Feel free to use this jQuery Plugin
	// Version: 1.0.1
    // Contributions by: 
	
	var gesturesX = 0;
	var gesturesY = 0;
	
	$(document).mousemove( function (e) {
		gesturesX = parseInt(e.pageX, 10);
		gesturesY = parseInt(e.pageY, 10);
	});
	
	$.fn.gestures = function (settings) {
	
		var config = {
			classModifier: "gestures",
			tolerance: 25,
			startEvent: "mousedown",
			endEvent: "mouseup",
			advancedShapes: false,
			shapeSpeed: 200,
			showTrail: false,
			trailSpeed: 50,
			eventLimit: 5000,
			eventHandler: function (eventName, compassPoint) {
				// Local variable eventName, uses eight point compass directions for the drag direction
				// Also, eventStartX, eventStaryY, eventEndX, eventEndY are all available with the details!
				$("#gestureoutput").attr("tabindex", "0").html("Event name '" + eventName + "'. Started at (" + eventStartX + ", " + eventStartY + ") Ended at (" + eventEndX + ", " + eventEndY + ")")[0].focus();
				if (eventName != "falsealarm") {
					$This.html(eventName); 
				}
			},
			eventHandlerAdvanced: function (directions) {
				// Local variable directions, returns a list of direction objects to be used to form a "shape"
				var output = GetCombinedName(directions, false, false);

				$("#gestureoutput").attr("tabindex", "0").html(output)[0].focus();
			}
		};
		
		if (settings) {
			$.extend(config, settings);
		}
		
		$This = null;
		$Body = null;
		var eventStartX = 0;
		var eventStartY = 0;
		var eventEndX = 0;
		var eventEndY = 0;
		var previousX = 0; // Advanced Tracking
		var previousY = 0; // Advanced Tracking
		var underEvent = false;
		
		var trailTimer = null;
		var shapeTimer = null;
		var eventTimer = null;
		
		// Determines the compass direction from a gesture
		function GetEvent(sx, sy, ex, ey) {
		
			var eventName = "none";
		
			var horizontalMovement = ex - sx;
			var verticalMovement = sy - ey;
		
			// Discard horizontal movements below the tolerance threshold
			if (horizontalMovement < config.tolerance && horizontalMovement > (config.tolerance * -1)) {
				horizontalMovement = 0;
			}

			// Discard vertical movements below the tolerance threshold
			if (verticalMovement < config.tolerance && verticalMovement > (config.tolerance * -1)) {
				verticalMovement = 0;
			}
			
			// For a diagonal move, horizontal should be within 50% of vertical otherwise we assume not diagonal
			if (horizontalMovement != 0 && verticalMovement != 0) {
				var h = horizontalMovement;
				var v = verticalMovement;
				// Use positive numbers for calculations
				if (h < 0) {
					h = h * -1;
				}
				if (v < 0) {
					v = v * -1;
				}
				// Check "diagonality" - if it isn't diagonal enough, make it flat
				if (h > v) {
					if (v < (h * 0.5)) {
						verticalMovement = 0;
					}
				} else {
					if (h < (v * 0.5)) {
						horizontalMovement = 0;
					}
				}
			}
			
			// Adjustments are all made... lets get the event...
			if (horizontalMovement != 0 && verticalMovement != 0) {
				eventName = "diagonal - direction to follow";
				if (horizontalMovement > 0) {
					if (verticalMovement > 0) {
						eventName = "NE";
					} else {
						eventName = "SE";
					}
				} else {
					if (verticalMovement > 0) {
						eventName = "NW";
					} else {
						eventName = "SW";
					}
				}
			} else if (horizontalMovement != 0) {
				if (horizontalMovement > 0) {
					eventName = "E";
				} else {
					eventName = "W";
				}
			} else if (verticalMovement != 0) {
				if (verticalMovement > 0) {
					eventName = "N";
				} else {
					eventName = "S";
				}
			} else {
				eventName = "falsealarm";
			}
		
			return eventName;
		}
		
		function GetCombinedName(directions, dropDiagonals, dropNonDiagonals) {
			var output = "";
			for (var i = 0; i < directions.length; i++) {
				var show = true;
				
				if (dropDiagonals) {
					if (directions[i].d.length == 2) {
						show = false;
					}
				}
				
				if (dropNonDiagonals) {
					if (directions[i].d.length == 1) {
						show = false;
					}
				}
			
				if (show) {
					output += directions[i].d + " ";
				}
			}
			return $.trim(output);
		}
		
		// Displays a trail for the mouse movement
		function TrackTrail() {
			if (underEvent) {
				$Body.append("<div class=\"" + config.classModifier + "motion\" style=\"position: absolute; top: " + gesturesY + "px; left :" + gesturesX + "px;\">.</div>");
				trailTimer = window.setTimeout(TrackTrail, config.trailSpeed);
			}
		}
		
		// Clears any trail
		function ClearTrail() {
			$("." + config.classModifier + "motion").fadeOut(1000, function () { $(this).remove(); });
		}
		
		var directionArray;
		
		function TrackDirections() {
			if (underEvent) {
			
				var xLength = gesturesX - previousX;
				var yLength = gesturesY - previousY;
				
				if (xLength < 0) {
					xLength = xLength * -1;
				}
				
				if (yLength < 0) {
					yLength = yLength * -1;
				}
	
				// If the lengths are over the ignorable tolerance
				if (xLength > config.tolerance || yLength > config.tolerance) {
	
					var direction = GetEvent(previousX, previousY, gesturesX, gesturesY);
					if (direction != "falsealarm") {
						previousX = gesturesX;
						previousY = gesturesY;
						if (directionArray.length == 0) {
							directionArray[directionArray.length] = { d: direction, lx: xLength, ly: yLength };
							config.eventHandler(direction);
						} else{
							if (direction != directionArray[directionArray.length - 1].d) {
								directionArray[directionArray.length] = { d: direction, lx: xLength, ly: yLength };
								config.eventHandler(direction);
							} else {
								directionArray[directionArray.length - 1].lx += xLength;
								directionArray[directionArray.length - 1].ly += yLength;
							}
						}
					}
				}
				
				shapeTimer = window.setTimeout(TrackDirections, config.shapeSpeed);
			}
		}
		
		// Starts tracking
		function StartTracking() {
			if (!underEvent) {
				underEvent = true;
				eventStartX = gesturesX;
				eventStartY = gesturesY;
				// In case the mouse up event is lost, this will force the stop event
				eventTimer = window.setTimeout(EndTracking, config.eventLimit);
				// Track Advanced Shapes
				if (config.advancedShapes) {
					previousX = gesturesX;
					previousY = gesturesY;
					directionArray = new Array();
					TrackDirections();
				}
				// Track Mouse Trail
				if (config.showTrail) {
					TrackTrail();
				}
			}
		}
		
		// Ends tracking
		function EndTracking() {
			window.clearTimeout(eventTimer);
			if (underEvent) {
				underEvent = false;
				eventEndX = gesturesX;
				eventEndY = gesturesY;
				// Track Advanced Shapes
				if (config.advancedShapes) {
					if (directionArray.length > 0) {
						config.eventHandlerAdvanced(directionArray);
					}
				} else {
					// Simple Event
					config.eventHandler(GetEvent(eventStartX, eventStartY, eventEndX, eventEndY));
				}
				// Track Mouse Trail
				if (config.showTrail) {
					ClearTrail();
				}
			}
		}
		
		
		
		return this.each( function () {
			$This = $(this);
			$Body = $("body").eq(0);

			$This.bind(config.startEvent, function () {
				StartTracking();
				return false;
			});
			
			$Body.bind(config.endEvent, function () {
				EndTracking();
				return false;
			});
		});
		
		return this;
	};
})(jQuery);