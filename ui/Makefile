# TODO: build to a BUILD_DIR...
# TODO: build all target platforms...
#	- Windows (AppJS)
#	- MacOSX (AppJS)
#	- Windows8 (native?) XXX
#	- PhoneGap-remote
#	  push and api call to fetch and rebuild
#	- PhoneGap-local XXX

# process LESS files to CSS...
%.css: %.less
	lessc $< > $@

# minify js...
%.min.js: %.js
	uglifyjs $< -c -o $@



# get all the .less files to process...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

# get files to minify...
JS_FILES := $(patsubst %.js,%.min.js,$(wildcard *.js))



all: css


css: $(CSS_FILES)

minify: $(JS_FILES)


# build targets...

windows: css minify

mac: css minify

phonegap-remote: css minify



clean:
	@rm -f $(CSS_FILES)
	@rm -f $(JS_FILES)
