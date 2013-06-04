
%.css: %.less
	lessc $< > $@

CSS_FILES := $(patsubst %.less,%.css,$(wildcard *.less))

# make this search for all *.less files...
TARGET= layout.css



all: $(CSS_FILES)

clean:
	@rm -f $(TARGET)
