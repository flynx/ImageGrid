#!/bin/bash

# extract hi-res previews...
#exiftool -b -JpgFromRaw -w "%-:1d/hi-res (RAW)/%f.jpg" -ext NEF -r .


# extract metadata in JSON format...
exiftool -j -w "%-:1d/metadata/%f.json" -ext NEF -r . -progress 

