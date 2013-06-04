# TODO: add minification... (???)


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

clean:
	@rm -f $(CSS_FILES)
	@rm -f $(JS_FILES)
