
TARGET=layout.css

LESS_FILE=layout.less

$(TARGET): $(LESS_FILE)
	lessc $(LESS_FILE) > $(TARGET)

clean:
	rm -f $(TARGET)

# Makefile dependencies...
$(OBJ): Makefile
$(TARGET): Makefile

