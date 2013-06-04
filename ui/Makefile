
%.css: %.less
	lessc $< > $@

CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

all: $(CSS_FILES)

clean:
	@rm -f $(CSS_FILES)
