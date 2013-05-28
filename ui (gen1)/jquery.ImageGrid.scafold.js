(function($){
	$.ImageGridUI = function(el, options, options){
		// To avoid scope issues, use 'base' instead of 'this'
		// to reference this class from internal events and functions.
		var base = this;
		
		// Access to jQuery and DOM versions of element
		base.$el = $(el);
		base.el = el;
		
		// Add a reverse reference to the DOM object
		base.$el.data("ImageGridUI", base);
		
		base.init = function(){
			
			base.options = $.extend({},$.ImageGridUI.defaultOptions, options);
			
			// Put your initialization code here
		};
		
		// Sample Function, Uncomment to use
		// base.functionName = function(paramaters){
		// 
		// };
		
		// Run initializer
		base.init();
	};
	
	$.ImageGridUI.defaultOptions = {
	};
	
	$.fn.imageGridUI = function(options, options){
		return this.each(function(){
			(new $.ImageGridUI(this, options, options));
		});
	};
	
	// This function breaks the chain, but returns
	// the ImageGridUI if it has been attached to the object.
	$.fn.getImageGridUI = function(){
		this.data("ImageGridUI");
	};
	
})(jQuery);

// vim:set ts=4 sw=4 nowrap :
