# TODO: add minification... (???)


# process LESS files to CSS...
%.css: %.less
	lessc $< > $@

# minify js...
%.min.js: %.js
	uglifyjs $< -c -o $@



# get all the .less files to process...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

JS_FILES := $(patsubst %.js,%.min.js,$(wildcard *.js))


minify: $(JS_FILES)

all: $(CSS_FILES)

clean:
	@rm -f $(CSS_FILES)
