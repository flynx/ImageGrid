# TODO: add minification... (???)


# rule for processing LESS files to CSS...
%.css: %.less
	lessc $< > $@

# get all the .less files to process...
CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

all: $(CSS_FILES)

clean:
	@rm -f $(CSS_FILES)
