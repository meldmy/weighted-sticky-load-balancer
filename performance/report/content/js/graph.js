/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
$(document).ready(function() {

    $(".click-title").mouseenter( function(    e){
        e.preventDefault();
        this.style.cursor="pointer";
    });
    $(".click-title").mousedown( function(event){
        event.preventDefault();
    });

    // Ugly code while this script is shared among several pages
    try{
        refreshHitsPerSecond(true);
    } catch(e){}
    try{
        refreshResponseTimeOverTime(true);
    } catch(e){}
    try{
        refreshResponseTimePercentiles();
    } catch(e){}
    $(".portlet-header").css("cursor", "auto");
});

var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

// Fixes time stamps
function fixTimeStamps(series, offset){
    $.each(series, function(index, item) {
        $.each(item.data, function(index, coord) {
            coord[0] += offset;
        });
    });
}

// Check if the specified jquery object is a graph
function isGraph(object){
    return object.data('plot') !== undefined;
}

/**
 * Export graph to a PNG
 */
function exportToPNG(graphName, target) {
    var plot = $("#"+graphName).data('plot');
    var flotCanvas = plot.getCanvas();
    var image = flotCanvas.toDataURL();
    image = image.replace("image/png", "image/octet-stream");
    
    var downloadAttrSupported = ("download" in document.createElement("a"));
    if(downloadAttrSupported === true) {
        target.download = graphName + ".png";
        target.href = image;
    }
    else {
        document.location.href = image;
    }
    
}

// Override the specified graph options to fit the requirements of an overview
function prepareOverviewOptions(graphOptions){
    var overviewOptions = {
        series: {
            shadowSize: 0,
            lines: {
                lineWidth: 1
            },
            points: {
                // Show points on overview only when linked graph does not show
                // lines
                show: getProperty('series.lines.show', graphOptions) == false,
                radius : 1
            }
        },
        xaxis: {
            ticks: 2,
            axisLabel: null
        },
        yaxis: {
            ticks: 2,
            axisLabel: null
        },
        legend: {
            show: false,
            container: null
        },
        grid: {
            hoverable: false
        },
        tooltip: false
    };
    return $.extend(true, {}, graphOptions, overviewOptions);
}

// Force axes boundaries using graph extra options
function prepareOptions(options, data) {
    options.canvas = true;
    var extraOptions = data.extraOptions;
    if(extraOptions !== undefined){
        var xOffset = options.xaxis.mode === "time" ? 7200000 : 0;
        var yOffset = options.yaxis.mode === "time" ? 7200000 : 0;

        if(!isNaN(extraOptions.minX))
        	options.xaxis.min = parseFloat(extraOptions.minX) + xOffset;
        
        if(!isNaN(extraOptions.maxX))
        	options.xaxis.max = parseFloat(extraOptions.maxX) + xOffset;
        
        if(!isNaN(extraOptions.minY))
        	options.yaxis.min = parseFloat(extraOptions.minY) + yOffset;
        
        if(!isNaN(extraOptions.maxY))
        	options.yaxis.max = parseFloat(extraOptions.maxY) + yOffset;
    }
}

// Filter, mark series and sort data
/**
 * @param data
 * @param noMatchColor if defined and true, series.color are not matched with index
 */
function prepareSeries(data, noMatchColor){
    var result = data.result;

    // Keep only series when needed
    if(seriesFilter && (!filtersOnlySampleSeries || result.supportsControllersDiscrimination)){
        // Insensitive case matching
        var regexp = new RegExp(seriesFilter, 'i');
        result.series = $.grep(result.series, function(series, index){
            return regexp.test(series.label);
        });
    }

    // Keep only controllers series when supported and needed
    if(result.supportsControllersDiscrimination && showControllersOnly){
        result.series = $.grep(result.series, function(series, index){
            return series.isController;
        });
    }

    // Sort data and mark series
    $.each(result.series, function(index, series) {
        series.data.sort(compareByXCoordinate);
        if(!(noMatchColor && noMatchColor===true)) {
	        series.color = index;
	    }
    });
}

// Set the zoom on the specified plot object
function zoomPlot(plot, xmin, xmax, ymin, ymax){
    var axes = plot.getAxes();
    // Override axes min and max options
    $.extend(true, axes, {
        xaxis: {
            options : { min: xmin, max: xmax }
        },
        yaxis: {
            options : { min: ymin, max: ymax }
        }
    });

    // Redraw the plot
    plot.setupGrid();
    plot.draw();
}

// Prepares DOM items to add zoom function on the specified graph
function setGraphZoomable(graphSelector, overviewSelector){
    var graph = $(graphSelector);
    var overview = $(overviewSelector);

    // Ignore mouse down event
    graph.bind("mousedown", function() { return false; });
    overview.bind("mousedown", function() { return false; });

    // Zoom on selection
    graph.bind("plotselected", function (event, ranges) {
        // clamp the zooming to prevent infinite zoom
        if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
            ranges.xaxis.to = ranges.xaxis.from + 0.00001;
        }
        if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
            ranges.yaxis.to = ranges.yaxis.from + 0.00001;
        }

        // Do the zooming
        var plot = graph.data('plot');
        zoomPlot(plot, ranges.xaxis.from, ranges.xaxis.to, ranges.yaxis.from, ranges.yaxis.to);
        plot.clearSelection();

        // Synchronize overview selection
        overview.data('plot').setSelection(ranges, true);
    });

    // Zoom linked graph on overview selection
    overview.bind("plotselected", function (event, ranges) {
        graph.data('plot').setSelection(ranges);
    });

    // Reset linked graph zoom when reseting overview selection
    overview.bind("plotunselected", function () {
        var overviewAxes = overview.data('plot').getAxes();
        zoomPlot(graph.data('plot'), overviewAxes.xaxis.min, overviewAxes.xaxis.max, overviewAxes.yaxis.min, overviewAxes.yaxis.max);
    });
}

var responseTimePercentilesInfos = {
        data: {"result": {"minY": 0.0, "minX": 0.0, "maxY": 3047.0, "series": [{"data": [[0.0, 0.0], [0.1, 0.0], [0.2, 0.0], [0.3, 0.0], [0.4, 0.0], [0.5, 0.0], [0.6, 0.0], [0.7, 0.0], [0.8, 0.0], [0.9, 0.0], [1.0, 0.0], [1.1, 0.0], [1.2, 0.0], [1.3, 0.0], [1.4, 0.0], [1.5, 0.0], [1.6, 0.0], [1.7, 0.0], [1.8, 1.0], [1.9, 1.0], [2.0, 1.0], [2.1, 1.0], [2.2, 1.0], [2.3, 1.0], [2.4, 1.0], [2.5, 1.0], [2.6, 1.0], [2.7, 1.0], [2.8, 1.0], [2.9, 1.0], [3.0, 1.0], [3.1, 1.0], [3.2, 1.0], [3.3, 1.0], [3.4, 1.0], [3.5, 1.0], [3.6, 1.0], [3.7, 1.0], [3.8, 1.0], [3.9, 1.0], [4.0, 1.0], [4.1, 1.0], [4.2, 1.0], [4.3, 1.0], [4.4, 1.0], [4.5, 1.0], [4.6, 1.0], [4.7, 1.0], [4.8, 1.0], [4.9, 1.0], [5.0, 1.0], [5.1, 1.0], [5.2, 1.0], [5.3, 1.0], [5.4, 1.0], [5.5, 1.0], [5.6, 1.0], [5.7, 1.0], [5.8, 1.0], [5.9, 1.0], [6.0, 1.0], [6.1, 1.0], [6.2, 1.0], [6.3, 1.0], [6.4, 1.0], [6.5, 1.0], [6.6, 1.0], [6.7, 1.0], [6.8, 1.0], [6.9, 1.0], [7.0, 1.0], [7.1, 1.0], [7.2, 2.0], [7.3, 2.0], [7.4, 2.0], [7.5, 2.0], [7.6, 2.0], [7.7, 2.0], [7.8, 2.0], [7.9, 2.0], [8.0, 2.0], [8.1, 2.0], [8.2, 2.0], [8.3, 2.0], [8.4, 2.0], [8.5, 2.0], [8.6, 2.0], [8.7, 2.0], [8.8, 2.0], [8.9, 2.0], [9.0, 2.0], [9.1, 2.0], [9.2, 2.0], [9.3, 2.0], [9.4, 2.0], [9.5, 2.0], [9.6, 2.0], [9.7, 2.0], [9.8, 2.0], [9.9, 2.0], [10.0, 2.0], [10.1, 2.0], [10.2, 2.0], [10.3, 2.0], [10.4, 2.0], [10.5, 2.0], [10.6, 2.0], [10.7, 2.0], [10.8, 2.0], [10.9, 2.0], [11.0, 2.0], [11.1, 2.0], [11.2, 2.0], [11.3, 2.0], [11.4, 2.0], [11.5, 2.0], [11.6, 2.0], [11.7, 2.0], [11.8, 2.0], [11.9, 2.0], [12.0, 2.0], [12.1, 2.0], [12.2, 2.0], [12.3, 2.0], [12.4, 2.0], [12.5, 2.0], [12.6, 2.0], [12.7, 2.0], [12.8, 2.0], [12.9, 3.0], [13.0, 3.0], [13.1, 3.0], [13.2, 3.0], [13.3, 3.0], [13.4, 3.0], [13.5, 3.0], [13.6, 3.0], [13.7, 3.0], [13.8, 3.0], [13.9, 3.0], [14.0, 3.0], [14.1, 3.0], [14.2, 3.0], [14.3, 3.0], [14.4, 3.0], [14.5, 3.0], [14.6, 3.0], [14.7, 3.0], [14.8, 3.0], [14.9, 3.0], [15.0, 3.0], [15.1, 3.0], [15.2, 3.0], [15.3, 3.0], [15.4, 3.0], [15.5, 3.0], [15.6, 3.0], [15.7, 3.0], [15.8, 3.0], [15.9, 3.0], [16.0, 3.0], [16.1, 3.0], [16.2, 3.0], [16.3, 3.0], [16.4, 3.0], [16.5, 3.0], [16.6, 3.0], [16.7, 3.0], [16.8, 3.0], [16.9, 3.0], [17.0, 3.0], [17.1, 3.0], [17.2, 3.0], [17.3, 3.0], [17.4, 3.0], [17.5, 3.0], [17.6, 3.0], [17.7, 3.0], [17.8, 3.0], [17.9, 3.0], [18.0, 3.0], [18.1, 3.0], [18.2, 4.0], [18.3, 4.0], [18.4, 4.0], [18.5, 4.0], [18.6, 4.0], [18.7, 4.0], [18.8, 4.0], [18.9, 4.0], [19.0, 4.0], [19.1, 4.0], [19.2, 4.0], [19.3, 4.0], [19.4, 4.0], [19.5, 4.0], [19.6, 4.0], [19.7, 4.0], [19.8, 4.0], [19.9, 4.0], [20.0, 4.0], [20.1, 4.0], [20.2, 4.0], [20.3, 4.0], [20.4, 4.0], [20.5, 4.0], [20.6, 4.0], [20.7, 4.0], [20.8, 4.0], [20.9, 4.0], [21.0, 4.0], [21.1, 4.0], [21.2, 4.0], [21.3, 4.0], [21.4, 4.0], [21.5, 4.0], [21.6, 4.0], [21.7, 4.0], [21.8, 4.0], [21.9, 4.0], [22.0, 4.0], [22.1, 4.0], [22.2, 4.0], [22.3, 4.0], [22.4, 4.0], [22.5, 4.0], [22.6, 4.0], [22.7, 4.0], [22.8, 4.0], [22.9, 5.0], [23.0, 5.0], [23.1, 5.0], [23.2, 5.0], [23.3, 5.0], [23.4, 5.0], [23.5, 5.0], [23.6, 5.0], [23.7, 5.0], [23.8, 5.0], [23.9, 5.0], [24.0, 5.0], [24.1, 5.0], [24.2, 5.0], [24.3, 5.0], [24.4, 5.0], [24.5, 5.0], [24.6, 5.0], [24.7, 5.0], [24.8, 5.0], [24.9, 5.0], [25.0, 5.0], [25.1, 5.0], [25.2, 5.0], [25.3, 5.0], [25.4, 5.0], [25.5, 5.0], [25.6, 5.0], [25.7, 5.0], [25.8, 5.0], [25.9, 5.0], [26.0, 5.0], [26.1, 5.0], [26.2, 5.0], [26.3, 5.0], [26.4, 5.0], [26.5, 5.0], [26.6, 5.0], [26.7, 5.0], [26.8, 5.0], [26.9, 5.0], [27.0, 5.0], [27.1, 6.0], [27.2, 6.0], [27.3, 6.0], [27.4, 6.0], [27.5, 6.0], [27.6, 6.0], [27.7, 6.0], [27.8, 6.0], [27.9, 6.0], [28.0, 6.0], [28.1, 6.0], [28.2, 6.0], [28.3, 6.0], [28.4, 6.0], [28.5, 6.0], [28.6, 6.0], [28.7, 6.0], [28.8, 6.0], [28.9, 6.0], [29.0, 6.0], [29.1, 6.0], [29.2, 6.0], [29.3, 6.0], [29.4, 6.0], [29.5, 6.0], [29.6, 6.0], [29.7, 6.0], [29.8, 6.0], [29.9, 6.0], [30.0, 6.0], [30.1, 6.0], [30.2, 6.0], [30.3, 6.0], [30.4, 6.0], [30.5, 6.0], [30.6, 6.0], [30.7, 6.0], [30.8, 7.0], [30.9, 7.0], [31.0, 7.0], [31.1, 7.0], [31.2, 7.0], [31.3, 7.0], [31.4, 7.0], [31.5, 7.0], [31.6, 7.0], [31.7, 7.0], [31.8, 7.0], [31.9, 7.0], [32.0, 7.0], [32.1, 7.0], [32.2, 7.0], [32.3, 7.0], [32.4, 7.0], [32.5, 7.0], [32.6, 7.0], [32.7, 7.0], [32.8, 7.0], [32.9, 7.0], [33.0, 7.0], [33.1, 7.0], [33.2, 7.0], [33.3, 7.0], [33.4, 7.0], [33.5, 7.0], [33.6, 7.0], [33.7, 7.0], [33.8, 7.0], [33.9, 7.0], [34.0, 7.0], [34.1, 7.0], [34.2, 8.0], [34.3, 8.0], [34.4, 8.0], [34.5, 8.0], [34.6, 8.0], [34.7, 8.0], [34.8, 8.0], [34.9, 8.0], [35.0, 8.0], [35.1, 8.0], [35.2, 8.0], [35.3, 8.0], [35.4, 8.0], [35.5, 8.0], [35.6, 8.0], [35.7, 8.0], [35.8, 8.0], [35.9, 8.0], [36.0, 8.0], [36.1, 8.0], [36.2, 8.0], [36.3, 8.0], [36.4, 8.0], [36.5, 8.0], [36.6, 8.0], [36.7, 8.0], [36.8, 8.0], [36.9, 8.0], [37.0, 8.0], [37.1, 8.0], [37.2, 9.0], [37.3, 9.0], [37.4, 9.0], [37.5, 9.0], [37.6, 9.0], [37.7, 9.0], [37.8, 9.0], [37.9, 9.0], [38.0, 9.0], [38.1, 9.0], [38.2, 9.0], [38.3, 9.0], [38.4, 9.0], [38.5, 9.0], [38.6, 9.0], [38.7, 9.0], [38.8, 9.0], [38.9, 9.0], [39.0, 9.0], [39.1, 9.0], [39.2, 9.0], [39.3, 9.0], [39.4, 9.0], [39.5, 9.0], [39.6, 9.0], [39.7, 9.0], [39.8, 9.0], [39.9, 9.0], [40.0, 10.0], [40.1, 10.0], [40.2, 10.0], [40.3, 10.0], [40.4, 10.0], [40.5, 10.0], [40.6, 10.0], [40.7, 10.0], [40.8, 10.0], [40.9, 10.0], [41.0, 10.0], [41.1, 10.0], [41.2, 10.0], [41.3, 10.0], [41.4, 10.0], [41.5, 10.0], [41.6, 10.0], [41.7, 10.0], [41.8, 10.0], [41.9, 10.0], [42.0, 10.0], [42.1, 10.0], [42.2, 10.0], [42.3, 10.0], [42.4, 10.0], [42.5, 10.0], [42.6, 11.0], [42.7, 11.0], [42.8, 11.0], [42.9, 11.0], [43.0, 11.0], [43.1, 11.0], [43.2, 11.0], [43.3, 11.0], [43.4, 11.0], [43.5, 11.0], [43.6, 11.0], [43.7, 11.0], [43.8, 11.0], [43.9, 11.0], [44.0, 11.0], [44.1, 11.0], [44.2, 11.0], [44.3, 11.0], [44.4, 11.0], [44.5, 11.0], [44.6, 11.0], [44.7, 11.0], [44.8, 11.0], [44.9, 12.0], [45.0, 12.0], [45.1, 12.0], [45.2, 12.0], [45.3, 12.0], [45.4, 12.0], [45.5, 12.0], [45.6, 12.0], [45.7, 12.0], [45.8, 12.0], [45.9, 12.0], [46.0, 12.0], [46.1, 12.0], [46.2, 12.0], [46.3, 12.0], [46.4, 12.0], [46.5, 12.0], [46.6, 12.0], [46.7, 12.0], [46.8, 12.0], [46.9, 13.0], [47.0, 13.0], [47.1, 13.0], [47.2, 13.0], [47.3, 13.0], [47.4, 13.0], [47.5, 13.0], [47.6, 13.0], [47.7, 13.0], [47.8, 13.0], [47.9, 13.0], [48.0, 13.0], [48.1, 13.0], [48.2, 13.0], [48.3, 13.0], [48.4, 13.0], [48.5, 13.0], [48.6, 13.0], [48.7, 14.0], [48.8, 14.0], [48.9, 14.0], [49.0, 14.0], [49.1, 14.0], [49.2, 14.0], [49.3, 14.0], [49.4, 14.0], [49.5, 14.0], [49.6, 14.0], [49.7, 14.0], [49.8, 14.0], [49.9, 14.0], [50.0, 14.0], [50.1, 14.0], [50.2, 14.0], [50.3, 15.0], [50.4, 15.0], [50.5, 15.0], [50.6, 15.0], [50.7, 15.0], [50.8, 15.0], [50.9, 15.0], [51.0, 15.0], [51.1, 15.0], [51.2, 15.0], [51.3, 15.0], [51.4, 15.0], [51.5, 15.0], [51.6, 15.0], [51.7, 16.0], [51.8, 16.0], [51.9, 16.0], [52.0, 16.0], [52.1, 16.0], [52.2, 16.0], [52.3, 16.0], [52.4, 16.0], [52.5, 16.0], [52.6, 16.0], [52.7, 16.0], [52.8, 16.0], [52.9, 16.0], [53.0, 17.0], [53.1, 17.0], [53.2, 17.0], [53.3, 17.0], [53.4, 17.0], [53.5, 17.0], [53.6, 17.0], [53.7, 17.0], [53.8, 17.0], [53.9, 17.0], [54.0, 17.0], [54.1, 17.0], [54.2, 17.0], [54.3, 18.0], [54.4, 18.0], [54.5, 18.0], [54.6, 18.0], [54.7, 18.0], [54.8, 18.0], [54.9, 18.0], [55.0, 18.0], [55.1, 18.0], [55.2, 18.0], [55.3, 18.0], [55.4, 19.0], [55.5, 19.0], [55.6, 19.0], [55.7, 19.0], [55.8, 19.0], [55.9, 19.0], [56.0, 19.0], [56.1, 19.0], [56.2, 19.0], [56.3, 19.0], [56.4, 20.0], [56.5, 20.0], [56.6, 20.0], [56.7, 20.0], [56.8, 20.0], [56.9, 20.0], [57.0, 20.0], [57.1, 20.0], [57.2, 20.0], [57.3, 21.0], [57.4, 21.0], [57.5, 21.0], [57.6, 21.0], [57.7, 21.0], [57.8, 21.0], [57.9, 21.0], [58.0, 21.0], [58.1, 22.0], [58.2, 22.0], [58.3, 22.0], [58.4, 22.0], [58.5, 22.0], [58.6, 22.0], [58.7, 23.0], [58.8, 23.0], [58.9, 23.0], [59.0, 23.0], [59.1, 23.0], [59.2, 23.0], [59.3, 24.0], [59.4, 24.0], [59.5, 24.0], [59.6, 24.0], [59.7, 24.0], [59.8, 24.0], [59.9, 25.0], [60.0, 25.0], [60.1, 25.0], [60.2, 25.0], [60.3, 25.0], [60.4, 25.0], [60.5, 26.0], [60.6, 26.0], [60.7, 26.0], [60.8, 26.0], [60.9, 26.0], [61.0, 27.0], [61.1, 27.0], [61.2, 27.0], [61.3, 27.0], [61.4, 27.0], [61.5, 28.0], [61.6, 28.0], [61.7, 28.0], [61.8, 28.0], [61.9, 28.0], [62.0, 29.0], [62.1, 29.0], [62.2, 29.0], [62.3, 29.0], [62.4, 29.0], [62.5, 30.0], [62.6, 30.0], [62.7, 30.0], [62.8, 30.0], [62.9, 30.0], [63.0, 31.0], [63.1, 31.0], [63.2, 31.0], [63.3, 31.0], [63.4, 32.0], [63.5, 32.0], [63.6, 32.0], [63.7, 32.0], [63.8, 32.0], [63.9, 33.0], [64.0, 33.0], [64.1, 33.0], [64.2, 33.0], [64.3, 34.0], [64.4, 34.0], [64.5, 34.0], [64.6, 34.0], [64.7, 35.0], [64.8, 35.0], [64.9, 35.0], [65.0, 35.0], [65.1, 36.0], [65.2, 36.0], [65.3, 36.0], [65.4, 36.0], [65.5, 37.0], [65.6, 37.0], [65.7, 37.0], [65.8, 37.0], [65.9, 38.0], [66.0, 38.0], [66.1, 38.0], [66.2, 38.0], [66.3, 39.0], [66.4, 39.0], [66.5, 39.0], [66.6, 40.0], [66.7, 40.0], [66.8, 40.0], [66.9, 40.0], [67.0, 41.0], [67.1, 41.0], [67.2, 41.0], [67.3, 41.0], [67.4, 42.0], [67.5, 42.0], [67.6, 42.0], [67.7, 42.0], [67.8, 43.0], [67.9, 43.0], [68.0, 43.0], [68.1, 44.0], [68.2, 44.0], [68.3, 44.0], [68.4, 44.0], [68.5, 45.0], [68.6, 45.0], [68.7, 45.0], [68.8, 45.0], [68.9, 46.0], [69.0, 46.0], [69.1, 46.0], [69.2, 47.0], [69.3, 47.0], [69.4, 47.0], [69.5, 47.0], [69.6, 48.0], [69.7, 48.0], [69.8, 48.0], [69.9, 49.0], [70.0, 49.0], [70.1, 49.0], [70.2, 49.0], [70.3, 50.0], [70.4, 50.0], [70.5, 50.0], [70.6, 50.0], [70.7, 51.0], [70.8, 51.0], [70.9, 51.0], [71.0, 52.0], [71.1, 52.0], [71.2, 52.0], [71.3, 52.0], [71.4, 53.0], [71.5, 53.0], [71.6, 53.0], [71.7, 53.0], [71.8, 54.0], [71.9, 54.0], [72.0, 54.0], [72.1, 55.0], [72.2, 55.0], [72.3, 55.0], [72.4, 55.0], [72.5, 56.0], [72.6, 56.0], [72.7, 56.0], [72.8, 57.0], [72.9, 57.0], [73.0, 57.0], [73.1, 58.0], [73.2, 58.0], [73.3, 58.0], [73.4, 59.0], [73.5, 59.0], [73.6, 59.0], [73.7, 60.0], [73.8, 60.0], [73.9, 61.0], [74.0, 61.0], [74.1, 61.0], [74.2, 62.0], [74.3, 62.0], [74.4, 63.0], [74.5, 63.0], [74.6, 64.0], [74.7, 64.0], [74.8, 65.0], [74.9, 65.0], [75.0, 65.0], [75.1, 66.0], [75.2, 66.0], [75.3, 67.0], [75.4, 67.0], [75.5, 68.0], [75.6, 68.0], [75.7, 69.0], [75.8, 69.0], [75.9, 70.0], [76.0, 70.0], [76.1, 70.0], [76.2, 71.0], [76.3, 71.0], [76.4, 72.0], [76.5, 72.0], [76.6, 73.0], [76.7, 73.0], [76.8, 73.0], [76.9, 74.0], [77.0, 74.0], [77.1, 75.0], [77.2, 75.0], [77.3, 76.0], [77.4, 76.0], [77.5, 76.0], [77.6, 77.0], [77.7, 77.0], [77.8, 78.0], [77.9, 78.0], [78.0, 78.0], [78.1, 79.0], [78.2, 79.0], [78.3, 80.0], [78.4, 80.0], [78.5, 80.0], [78.6, 81.0], [78.7, 81.0], [78.8, 82.0], [78.9, 82.0], [79.0, 82.0], [79.1, 83.0], [79.2, 83.0], [79.3, 84.0], [79.4, 84.0], [79.5, 84.0], [79.6, 85.0], [79.7, 85.0], [79.8, 86.0], [79.9, 86.0], [80.0, 86.0], [80.1, 87.0], [80.2, 87.0], [80.3, 87.0], [80.4, 88.0], [80.5, 88.0], [80.6, 89.0], [80.7, 89.0], [80.8, 89.0], [80.9, 90.0], [81.0, 90.0], [81.1, 91.0], [81.2, 91.0], [81.3, 91.0], [81.4, 92.0], [81.5, 92.0], [81.6, 93.0], [81.7, 93.0], [81.8, 94.0], [81.9, 94.0], [82.0, 94.0], [82.1, 95.0], [82.2, 96.0], [82.3, 96.0], [82.4, 97.0], [82.5, 97.0], [82.6, 98.0], [82.7, 98.0], [82.8, 99.0], [82.9, 99.0], [83.0, 100.0], [83.1, 100.0], [83.2, 100.0], [83.3, 101.0], [83.4, 101.0], [83.5, 102.0], [83.6, 102.0], [83.7, 103.0], [83.8, 103.0], [83.9, 103.0], [84.0, 104.0], [84.1, 104.0], [84.2, 105.0], [84.3, 105.0], [84.4, 105.0], [84.5, 106.0], [84.6, 106.0], [84.7, 107.0], [84.8, 107.0], [84.9, 108.0], [85.0, 108.0], [85.1, 109.0], [85.2, 109.0], [85.3, 110.0], [85.4, 110.0], [85.5, 111.0], [85.6, 111.0], [85.7, 111.0], [85.8, 112.0], [85.9, 112.0], [86.0, 113.0], [86.1, 113.0], [86.2, 114.0], [86.3, 114.0], [86.4, 115.0], [86.5, 115.0], [86.6, 115.0], [86.7, 116.0], [86.8, 116.0], [86.9, 117.0], [87.0, 117.0], [87.1, 118.0], [87.2, 118.0], [87.3, 119.0], [87.4, 119.0], [87.5, 119.0], [87.6, 120.0], [87.7, 120.0], [87.8, 121.0], [87.9, 121.0], [88.0, 122.0], [88.1, 123.0], [88.2, 123.0], [88.3, 124.0], [88.4, 124.0], [88.5, 125.0], [88.6, 125.0], [88.7, 126.0], [88.8, 127.0], [88.9, 127.0], [89.0, 128.0], [89.1, 128.0], [89.2, 129.0], [89.3, 129.0], [89.4, 130.0], [89.5, 130.0], [89.6, 131.0], [89.7, 131.0], [89.8, 132.0], [89.9, 133.0], [90.0, 133.0], [90.1, 134.0], [90.2, 134.0], [90.3, 135.0], [90.4, 136.0], [90.5, 136.0], [90.6, 137.0], [90.7, 138.0], [90.8, 138.0], [90.9, 139.0], [91.0, 140.0], [91.1, 140.0], [91.2, 141.0], [91.3, 142.0], [91.4, 142.0], [91.5, 143.0], [91.6, 144.0], [91.7, 145.0], [91.8, 146.0], [91.9, 146.0], [92.0, 147.0], [92.1, 148.0], [92.2, 149.0], [92.3, 150.0], [92.4, 151.0], [92.5, 151.0], [92.6, 152.0], [92.7, 153.0], [92.8, 155.0], [92.9, 156.0], [93.0, 157.0], [93.1, 158.0], [93.2, 160.0], [93.3, 161.0], [93.4, 162.0], [93.5, 164.0], [93.6, 165.0], [93.7, 167.0], [93.8, 169.0], [93.9, 170.0], [94.0, 172.0], [94.1, 173.0], [94.2, 175.0], [94.3, 178.0], [94.4, 180.0], [94.5, 181.0], [94.6, 184.0], [94.7, 187.0], [94.8, 189.0], [94.9, 192.0], [95.0, 195.0], [95.1, 198.0], [95.2, 200.0], [95.3, 202.0], [95.4, 205.0], [95.5, 208.0], [95.6, 211.0], [95.7, 214.0], [95.8, 218.0], [95.9, 221.0], [96.0, 224.0], [96.1, 227.0], [96.2, 230.0], [96.3, 234.0], [96.4, 239.0], [96.5, 244.0], [96.6, 249.0], [96.7, 252.0], [96.8, 257.0], [96.9, 261.0], [97.0, 265.0], [97.1, 270.0], [97.2, 275.0], [97.3, 279.0], [97.4, 283.0], [97.5, 286.0], [97.6, 290.0], [97.7, 295.0], [97.8, 303.0], [97.9, 311.0], [98.0, 320.0], [98.1, 329.0], [98.2, 338.0], [98.3, 350.0], [98.4, 360.0], [98.5, 373.0], [98.6, 388.0], [98.7, 405.0], [98.8, 421.0], [98.9, 438.0], [99.0, 451.0], [99.1, 465.0], [99.2, 482.0], [99.3, 505.0], [99.4, 535.0], [99.5, 587.0], [99.6, 646.0], [99.7, 796.0], [99.8, 1166.0], [99.9, 1564.0]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 100.0, "title": "Response Time Percentiles"}},
        getOptions: function() {
            return {
                series: {
                    points: { show: false }
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentiles'
                },
                xaxis: {
                    tickDecimals: 1,
                    axisLabel: "Percentiles",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Percentile value in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : %x.2 percentile was %y ms"
                },
                selection: { mode: "xy" },
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentiles"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesPercentiles"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesPercentiles"), dataset, prepareOverviewOptions(options));
        }
};

// Response times percentiles
function refreshResponseTimePercentiles() {
    var infos = responseTimePercentilesInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimesPercentiles"))){
        infos.createGraph();
    } else {
        var choiceContainer = $("#choicesResponseTimePercentiles");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesPercentiles", "#overviewResponseTimesPercentiles");
        $('#bodyResponseTimePercentiles .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimeDistributionInfos = {
        data: {"result": {"minY": 1.0, "minX": 0.0, "maxY": 752990.0, "series": [{"data": [[0.0, 752990.0], [2500.0, 135.0], [1500.0, 478.0], [3000.0, 1.0], [500.0, 3778.0], [1000.0, 790.0], [2000.0, 324.0]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 500, "maxX": 3000.0, "title": "Response Time Distribution"}},
        getOptions: function() {
            var granularity = this.data.result.granularity;
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    barWidth: this.data.result.granularity
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " responses for " + label + " were between " + xval + " and " + (xval + granularity) + " ms";
                    }
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimeDistribution"), prepareData(data.result.series, $("#choicesResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshResponseTimeDistribution() {
    var infos = responseTimeDistributionInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var syntheticResponseTimeDistributionInfos = {
        data: {"result": {"minY": 294.0, "minX": 0.0, "ticks": [[0, "Requests having \nresponse time <= 500ms"], [1, "Requests having \nresponse time > 500ms and <= 1,500ms"], [2, "Requests having \nresponse time > 1,500ms"], [3, "Requests in error"]], "maxY": 752845.0, "series": [{"data": [[1.0, 4472.0]], "isOverall": false, "label": "Requests having \nresponse time > 500ms and <= 1,500ms", "isController": false}, {"data": [[3.0, 294.0]], "isOverall": false, "label": "Requests in error", "isController": false}, {"data": [[0.0, 752845.0]], "isOverall": false, "label": "Requests having \nresponse time <= 500ms", "isController": false}, {"data": [[2.0, 885.0]], "isOverall": false, "label": "Requests having \nresponse time > 1,500ms", "isController": false}], "supportsControllersDiscrimination": false, "maxX": 3.0, "title": "Synthetic Response Times Distribution"}},
        getOptions: function() {
            return {
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendSyntheticResponseTimeDistribution'
                },
                xaxis:{
                    axisLabel: "Response times ranges",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                    tickLength:0,
                    min:-0.5,
                    max:3.5
                },
                yaxis: {
                    axisLabel: "Number of responses",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                bars : {
                    show: true,
                    align: "center",
                    barWidth: 0.25,
                    fill:.75
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: function(label, xval, yval, flotItem){
                        return yval + " " + label;
                    }
                },
                colors: ["#9ACD32", "yellow", "orange", "#FF6347"]                
            };
        },
        createGraph: function() {
            var data = this.data;
            var options = this.getOptions();
            prepareOptions(options, data);
            options.xaxis.ticks = data.result.ticks;
            $.plot($("#flotSyntheticResponseTimeDistribution"), prepareData(data.result.series, $("#choicesSyntheticResponseTimeDistribution")), options);
        }

};

// Response time distribution
function refreshSyntheticResponseTimeDistribution() {
    var infos = syntheticResponseTimeDistributionInfos;
    prepareSeries(infos.data, true);
    if (isGraph($("#flotSyntheticResponseTimeDistribution"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        $('#footerSyntheticResponseTimeDistribution .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var activeThreadsOverTimeInfos = {
        data: {"result": {"minY": 696.4513941447618, "minX": 1.50503346E12, "maxY": 972.2265968732139, "series": [{"data": [[1.50503352E12, 777.2792876065687], [1.50503358E12, 696.4513941447618], [1.50503346E12, 972.2265968732139]], "isOverall": false, "label": "Thread Group", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.50503358E12, "title": "Active Threads Over Time"}},
        getOptions: function() {
            return {
                series: {
                    stack: true,
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 6,
                    show: true,
                    container: '#legendActiveThreadsOverTime'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                selection: {
                    mode: 'xy'
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : At %x there were %y active threads"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesActiveThreadsOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotActiveThreadsOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewActiveThreadsOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Active Threads Over Time
function refreshActiveThreadsOverTime(fixTimestamps) {
    var infos = activeThreadsOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotActiveThreadsOverTime"))) {
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesActiveThreadsOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotActiveThreadsOverTime", "#overviewActiveThreadsOverTime");
        $('#footerActiveThreadsOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var timeVsThreadsInfos = {
        data: {"result": {"minY": 0.0, "minX": 2.0, "maxY": 2509.0, "series": [{"data": [[2.0, 0.33333333333333337], [4.0, 0.0], [6.0, 11.75], [7.0, 7.125], [8.0, 1.0], [9.0, 0.5], [10.0, 0.6666666666666667], [11.0, 1.0], [12.0, 1.076923076923077], [13.0, 1.0], [14.0, 1.3333333333333333], [15.0, 1.25], [16.0, 1.4], [18.0, 1.2], [20.0, 2.0], [21.0, 2.0], [22.0, 2.0], [23.0, 2.0], [24.0, 2.4000000000000004], [25.0, 4.555555555555555], [26.0, 3.5], [27.0, 3.0], [28.0, 3.6], [30.0, 4.307692307692308], [31.0, 5.0], [32.0, 4.8], [35.0, 4.4], [37.0, 5.428571428571429], [36.0, 4.75], [39.0, 5.0], [38.0, 5.2], [41.0, 5.0], [43.0, 5.125], [45.0, 5.0], [44.0, 5.571428571428571], [47.0, 5.0], [48.0, 6.0], [51.0, 6.0], [50.0, 5.5], [53.0, 6.142857142857143], [52.0, 7.25], [55.0, 7.5], [54.0, 6.65], [59.0, 7.111111111111111], [61.0, 7.0], [60.0, 9.125000000000002], [63.0, 8.333333333333334], [62.0, 8.166666666666666], [67.0, 9.6], [65.0, 9.375], [64.0, 8.0], [71.0, 9.6], [70.0, 10.0], [69.0, 9.5], [75.0, 26.42857142857143], [73.0, 9.5], [72.0, 9.0], [79.0, 12.75], [78.0, 14.0], [77.0, 41.2], [76.0, 12.125], [81.0, 13.4], [80.0, 12.6], [87.0, 13.428571428571429], [86.0, 11.0], [85.0, 15.25], [84.0, 18.0], [91.0, 12.8], [89.0, 28.000000000000004], [94.0, 9.0], [93.0, 13.0], [92.0, 12.0], [99.0, 8.0], [98.0, 7.75], [97.0, 8.8], [96.0, 20.181818181818183], [103.0, 6.800000000000001], [101.0, 7.6], [105.0, 6.0], [110.0, 6.200000000000001], [109.0, 6.0], [108.0, 6.230769230769232], [115.0, 12.8], [114.0, 8.5], [113.0, 47.25], [112.0, 6.0], [118.0, 6.25], [117.0, 7.0], [116.0, 10.714285714285715], [123.0, 6.0], [122.0, 6.0], [121.0, 6.125], [120.0, 6.2], [127.0, 6.0], [125.0, 5.624999999999999], [124.0, 6.0], [134.0, 4.0], [133.0, 4.333333333333333], [132.0, 4.25], [130.0, 5.0], [129.0, 5.0], [143.0, 7.8], [142.0, 5.0476190476190474], [140.0, 4.0], [138.0, 4.6], [137.0, 4.058823529411764], [136.0, 4.666666666666666], [150.0, 7.333333333333334], [149.0, 7.555555555555555], [148.0, 6.833333333333333], [147.0, 7.312499999999999], [146.0, 7.0], [145.0, 8.5], [144.0, 8.0], [159.0, 5.0], [158.0, 5.8], [157.0, 6.4], [156.0, 7.333333333333333], [154.0, 8.0], [153.0, 7.7272727272727275], [152.0, 7.857142857142857], [167.0, 11.4], [166.0, 7.333333333333333], [165.0, 6.0], [164.0, 6.0], [163.0, 6.75], [162.0, 6.2857142857142865], [161.0, 6.31578947368421], [175.0, 9.0], [173.0, 10.0], [172.0, 10.0], [171.0, 10.8], [170.0, 11.0], [169.0, 15.545454545454547], [168.0, 10.0], [183.0, 10.0], [182.0, 9.6], [181.0, 9.0], [180.0, 9.750000000000002], [178.0, 9.333333333333332], [177.0, 8.75], [191.0, 9.5], [190.0, 9.0], [189.0, 9.25], [188.0, 9.857142857142858], [186.0, 12.0], [185.0, 10.916666666666666], [184.0, 10.333333333333334], [199.0, 43.375], [198.0, 52.916666666666664], [197.0, 32.5], [196.0, 13.0], [194.0, 6.0], [193.0, 7.0], [192.0, 8.0], [207.0, 5.166666666666667], [206.0, 5.749999999999999], [205.0, 16.977777777777774], [204.0, 1.0], [203.0, 10.068965517241379], [202.0, 46.0], [201.0, 53.0], [200.0, 50.0], [215.0, 5.2], [214.0, 5.833333333333333], [213.0, 6.4], [212.0, 6.235294117647059], [211.0, 6.0], [210.0, 6.363636363636364], [209.0, 6.0], [208.0, 6.2], [223.0, 9.0], [222.0, 4.75], [221.0, 5.166666666666667], [220.0, 5.444444444444445], [219.0, 5.0], [218.0, 6.0], [217.0, 6.7142857142857135], [216.0, 6.666666666666666], [231.0, 5.6], [230.0, 5.666666666666667], [229.0, 5.2], [228.0, 5.440000000000001], [227.0, 6.666666666666667], [226.0, 8.0], [224.0, 7.75], [239.0, 8.0], [238.0, 8.5], [237.0, 8.785714285714286], [236.0, 10.0], [235.0, 9.928571428571429], [234.0, 10.666666666666668], [233.0, 9.666666666666664], [232.0, 7.666666666666666], [247.0, 8.5], [244.0, 8.200000000000001], [243.0, 7.0], [242.0, 8.25], [240.0, 24.6], [255.0, 5.666666666666667], [254.0, 6.555555555555555], [253.0, 7.0], [252.0, 8.833333333333334], [251.0, 8.916666666666668], [250.0, 10.0], [249.0, 9.375], [259.0, 3.0], [271.0, 8.333333333333336], [269.0, 5.523809523809525], [258.0, 4.0], [257.0, 5.142857142857143], [256.0, 5.571428571428572], [266.0, 5.5], [265.0, 4.916666666666667], [264.0, 4.0], [263.0, 4.75], [262.0, 5.0], [261.0, 3.4], [260.0, 2.5], [286.0, 5.0], [287.0, 4.5], [285.0, 4.5], [284.0, 4.3], [283.0, 5.2272727272727275], [282.0, 4.571428571428572], [281.0, 4.5], [280.0, 13.363636363636362], [279.0, 14.285714285714286], [273.0, 8.999999999999998], [275.0, 7.833333333333333], [274.0, 8.0], [278.0, 8.0], [276.0, 7.8076923076923075], [302.0, 4.173913043478261], [303.0, 4.777777777777778], [301.0, 1.7727272727272723], [300.0, 0.5], [299.0, 1.0], [298.0, 1.5], [297.0, 2.0], [296.0, 1.7777777777777777], [295.0, 2.5714285714285716], [289.0, 4.333333333333333], [288.0, 4.888888888888888], [291.0, 3.5], [290.0, 4.2], [294.0, 2.5], [293.0, 2.75], [317.0, 9.142857142857144], [318.0, 9.866666666666667], [316.0, 9.416666666666666], [315.0, 9.421052631578947], [313.0, 10.225806451612902], [312.0, 9.38888888888889], [310.0, 8.285714285714285], [308.0, 8.8], [306.0, 8.647058823529411], [305.0, 5.777777777777778], [304.0, 6.0], [334.0, 10.777777777777777], [335.0, 10.571428571428573], [333.0, 11.714285714285717], [332.0, 11.066666666666666], [331.0, 7.366666666666665], [330.0, 6.0], [329.0, 7.230769230769231], [328.0, 8.5], [327.0, 8.0], [321.0, 9.88888888888889], [320.0, 9.6], [323.0, 9.6], [322.0, 10.0], [326.0, 8.0], [325.0, 8.6], [349.0, 17.466666666666665], [350.0, 17.777777777777775], [348.0, 16.8], [338.0, 15.8], [337.0, 14.82608695652174], [347.0, 16.818181818181817], [346.0, 14.142857142857142], [345.0, 15.0], [344.0, 16.19047619047619], [343.0, 15.333333333333332], [342.0, 16.166666666666664], [341.0, 16.22], [340.0, 15.0], [364.0, 14.454545454545457], [366.0, 16.555555555555554], [367.0, 17.083333333333336], [365.0, 14.88888888888889], [363.0, 14.333333333333334], [360.0, 15.588235294117649], [359.0, 16.0], [353.0, 17.352941176470587], [352.0, 17.28571428571429], [355.0, 17.22222222222222], [354.0, 17.599999999999998], [358.0, 16.666666666666668], [356.0, 16.6875], [382.0, 17.857142857142854], [383.0, 17.8], [381.0, 19.799999999999997], [380.0, 21.0], [379.0, 22.882352941176467], [378.0, 20.925925925925924], [377.0, 20.75], [376.0, 20.36363636363636], [375.0, 20.77777777777778], [369.0, 19.750000000000004], [368.0, 19.133333333333333], [371.0, 18.714285714285715], [370.0, 19.875], [374.0, 20.4], [373.0, 21.714285714285715], [372.0, 20.354838709677416], [398.0, 8.0], [399.0, 10.909090909090908], [397.0, 8.0], [396.0, 8.842105263157892], [395.0, 8.2], [394.0, 9.2], [392.0, 10.0], [390.0, 11.392857142857142], [385.0, 15.608695652173914], [384.0, 14.75], [387.0, 14.266666666666666], [386.0, 14.5], [389.0, 12.333333333333334], [388.0, 13.7], [413.0, 21.0], [414.0, 29.4], [412.0, 25.0], [403.0, 6.0], [400.0, 13.000000000000002], [411.0, 15.666666666666668], [409.0, 20.058823529411764], [408.0, 10.783783783783788], [407.0, 8.555555555555555], [406.0, 6.75], [405.0, 6.166666666666667], [430.0, 21.22222222222222], [431.0, 21.88888888888889], [429.0, 21.517241379310345], [428.0, 20.0], [427.0, 19.214285714285715], [425.0, 17.0], [424.0, 41.333333333333336], [422.0, 50.5], [417.0, 41.16666666666667], [416.0, 25.0], [419.0, 24.333333333333332], [418.0, 19.666666666666668], [421.0, 47.5], [420.0, 45.0], [446.0, 36.42857142857143], [447.0, 36.0], [445.0, 35.84615384615385], [444.0, 34.171428571428564], [442.0, 77.65384615384615], [441.0, 33.0], [440.0, 32.529411764705884], [439.0, 30.833333333333332], [433.0, 24.0], [432.0, 23.44444444444444], [435.0, 28.200000000000003], [434.0, 26.24242424242425], [438.0, 28.666666666666668], [437.0, 28.46153846153846], [436.0, 27.090909090909093], [462.0, 155.0], [463.0, 152.1538461538462], [461.0, 163.36842105263153], [460.0, 146.86986301369865], [459.0, 148.66666666666666], [458.0, 130.0], [457.0, 140.875], [456.0, 78.7727272727273], [455.0, 61.51724137931034], [449.0, 38.0], [448.0, 36.888888888888886], [451.0, 107.14814814814817], [450.0, 38.09090909090909], [454.0, 40.300000000000004], [453.0, 40.0], [452.0, 41.857142857142854], [476.0, 8.915254237288137], [479.0, 3.0], [478.0, 6.885245901639344], [477.0, 9.2], [471.0, 146.671875], [465.0, 157.88888888888889], [464.0, 155.68749999999997], [470.0, 150.25000000000003], [469.0, 151.75], [468.0, 150.25], [467.0, 155.14285714285717], [466.0, 157.62500000000003], [494.0, 8.588235294117647], [495.0, 9.382352941176471], [493.0, 8.380952380952381], [492.0, 7.190476190476191], [491.0, 7.0], [490.0, 7.583333333333333], [489.0, 5.749999999999999], [488.0, 1.4999999999999998], [485.0, 1.0], [483.0, 0.45833333333333337], [482.0, 1.5555555555555554], [481.0, 2.260869565217391], [480.0, 3.5], [484.0, 9.454545454545455], [510.0, 3.5454545454545454], [511.0, 8.100000000000001], [509.0, 2.9230769230769234], [508.0, 0.5909090909090908], [507.0, 0.9285714285714286], [506.0, 2.9743589743589736], [505.0, 6.899999999999998], [504.0, 8.999999999999996], [503.0, 8.75], [497.0, 11.799999999999999], [496.0, 12.1875], [499.0, 10.621621621621623], [498.0, 11.695652173913045], [502.0, 8.714285714285715], [500.0, 8.139534883720934], [540.0, 180.6666666666667], [536.0, 220.40789473684205], [519.0, 10.571428571428571], [518.0, 11.1875], [517.0, 13.266666666666667], [516.0, 12.057142857142855], [515.0, 14.666666666666666], [514.0, 6.674418604651161], [513.0, 9.173913043478263], [512.0, 9.576923076923077], [527.0, 6.0], [525.0, 6.5], [521.0, 8.799999999999999], [520.0, 10.399999999999999], [537.0, 106.35542168674695], [539.0, 79.00000000000001], [541.0, 301.85017421602794], [543.0, 8.373493975903616], [529.0, 6.0], [528.0, 6.714285714285715], [531.0, 6.555555555555555], [530.0, 6.333333333333333], [533.0, 7.083333333333334], [532.0, 6.406250000000001], [542.0, 6.6], [538.0, 0.6666666666666667], [535.0, 6.0], [534.0, 7.133333333333334], [569.0, 29.885714285714286], [574.0, 30.9], [544.0, 394.0], [545.0, 1.0], [547.0, 10.045454545454545], [546.0, 3.0], [549.0, 8.25], [548.0, 9.959999999999996], [558.0, 9.866666666666665], [557.0, 11.0], [556.0, 9.589285714285714], [555.0, 8.241379310344826], [554.0, 3.5], [553.0, 4.714285714285714], [552.0, 2.888888888888889], [550.0, 59.76923076923077], [551.0, 55.04000000000001], [568.0, 30.0], [570.0, 29.072580645161295], [563.0, 413.0], [564.0, 124.5], [565.0, 8.916666666666668], [566.0, 30.833333333333325], [567.0, 28.27777777777778], [575.0, 32.5], [560.0, 7.666666666666667], [562.0, 18.333333333333332], [561.0, 5.828571428571427], [573.0, 28.95833333333333], [572.0, 28.1], [601.0, 48.37704918032788], [583.0, 87.0], [591.0, 29.23076923076923], [576.0, 32.57142857142857], [578.0, 34.2857142857143], [577.0, 33.375], [580.0, 37.57692307692308], [579.0, 35.2], [582.0, 39.31578947368421], [581.0, 40.49122807017544], [590.0, 30.218750000000004], [589.0, 33.0], [587.0, 34.06249999999999], [600.0, 44.857142857142854], [585.0, 197.5], [584.0, 37.0625], [586.0, 113.16666666666666], [593.0, 46.91666666666666], [594.0, 443.0], [595.0, 28.0], [597.0, 38.07692307692307], [596.0, 27.166666666666664], [598.0, 59.888888888888864], [599.0, 85.71052631578948], [602.0, 46.12727272727273], [603.0, 58.31818181818182], [607.0, 43.30769230769231], [592.0, 28.444444444444443], [606.0, 42.23489932885909], [604.0, 34.92857142857142], [636.0, 37.21052631578948], [612.0, 182.27272727272728], [611.0, 83.08333333333331], [610.0, 40.92307692307693], [609.0, 42.266666666666666], [608.0, 43.0], [623.0, 49.53333333333334], [622.0, 49.76923076923077], [621.0, 51.38709677419355], [614.0, 563.0], [613.0, 37.916666666666664], [633.0, 37.68181818181819], [632.0, 36.888888888888886], [635.0, 38.30952380952379], [634.0, 38.666666666666664], [637.0, 33.344444444444434], [616.0, 58.125000000000014], [617.0, 40.24705882352942], [619.0, 54.725000000000016], [618.0, 37.75], [620.0, 132.0], [639.0, 24.133333333333336], [625.0, 46.470588235294116], [624.0, 47.75], [627.0, 40.21951219512194], [626.0, 42.4], [629.0, 36.8], [628.0, 39.285714285714285], [631.0, 38.39999999999999], [630.0, 37.38235294117648], [638.0, 26.2], [668.0, 24.545454545454543], [671.0, 30.9], [657.0, 41.249999999999986], [656.0, 29.88888888888889], [659.0, 43.096491228070164], [658.0, 44.0], [661.0, 35.599999999999994], [660.0, 37.3421052631579], [670.0, 36.857142857142854], [669.0, 36.28125], [667.0, 18.522388059701495], [666.0, 20.252873563218387], [665.0, 25.346153846153847], [664.0, 29.406779661016948], [654.0, 29.230769230769234], [641.0, 45.736842105263165], [640.0, 32.06557377049181], [643.0, 36.74358974358975], [642.0, 37.87878787878788], [645.0, 35.0], [644.0, 35.592592592592595], [647.0, 32.16666666666667], [646.0, 34.487804878048784], [653.0, 31.986666666666665], [652.0, 34.142857142857146], [651.0, 36.822222222222216], [650.0, 38.8709677419355], [649.0, 42.0], [648.0, 37.32203389830509], [663.0, 31.285714285714285], [662.0, 31.97435897435898], [700.0, 69.62903225806453], [703.0, 20.065573770491806], [688.0, 27.74254742547425], [690.0, 52.51470588235293], [689.0, 42.97115384615385], [692.0, 54.44], [691.0, 56.881720430107514], [702.0, 28.611263736263744], [701.0, 46.90055248618783], [699.0, 76.85393258426969], [698.0, 93.31372549019605], [697.0, 118.6279069767442], [696.0, 130.42580645161283], [687.0, 22.5301724137931], [673.0, 32.31999999999999], [672.0, 29.799999999999997], [675.0, 27.08641975308641], [674.0, 32.32394366197183], [677.0, 16.641025641025646], [676.0, 21.46808510638298], [679.0, 21.444444444444432], [678.0, 13.049999999999999], [686.0, 94.66666666666664], [685.0, 23.05860805860805], [684.0, 9.000000000000004], [683.0, 11.666666666666666], [682.0, 17.460784313725497], [681.0, 18.428571428571423], [680.0, 19.058823529411764], [695.0, 85.13414634146335], [693.0, 60.16161616161612], [723.0, 2499.0], [734.0, 987.0], [735.0, 1141.4], [721.0, 2505.0], [733.0, 2500.0], [730.0, 2503.5], [728.0, 2498.0], [708.0, 54.199999999999996], [707.0, 510.6], [706.0, 22.22725528511001], [705.0, 11.755148741418749], [704.0, 18.424242424242422], [719.0, 2505.0], [717.0, 2504.0], [727.0, 2502.0], [726.0, 2509.0], [725.0, 2499.0], [752.0, 33.677278086575654], [755.0, 427.5], [754.0, 458.5], [753.0, 444.5], [751.0, 185.84158415841586], [737.0, 2499.75], [740.0, 2499.3333333333335], [738.0, 2498.0], [743.0, 2493.75], [741.0, 2495.0], [749.0, 2500.5], [748.0, 2499.5], [747.0, 2498.0], [746.0, 2498.0], [745.0, 2491.0], [797.0, 56.0], [798.0, 56.0], [784.0, 451.0], [796.0, 57.0], [794.0, 57.0], [793.0, 56.5], [792.0, 57.0], [783.0, 451.5], [773.0, 192.33333333333334], [769.0, 76.0], [781.0, 452.0], [780.0, 447.5], [778.0, 443.0], [776.0, 71.0], [790.0, 56.333333333333336], [789.0, 56.0], [787.0, 57.0], [785.0, 397.0], [830.0, 129.6], [831.0, 241.25], [817.0, 63.0], [816.0, 63.0], [828.0, 297.6666666666667], [827.0, 248.0], [826.0, 302.8333333333333], [824.0, 135.6], [814.0, 63.0], [800.0, 56.0], [803.0, 56.0], [801.0, 57.0], [806.0, 56.666666666666664], [804.0, 56.0], [812.0, 58.0], [809.0, 56.333333333333336], [808.0, 56.0], [822.0, 65.0], [821.0, 65.0], [820.0, 65.0], [818.0, 63.666666666666664], [851.0, 36.0], [861.0, 35.5], [862.0, 37.0], [848.0, 38.0], [860.0, 36.25], [858.0, 39.0], [856.0, 41.0], [832.0, 280.0], [847.0, 44.0], [843.0, 42.0], [855.0, 40.0], [853.0, 36.5], [852.0, 37.0], [869.0, 434.9977064220188], [876.0, 694.3333333333334], [868.0, 423.15739130434747], [879.0, 563.25], [864.0, 36.0], [865.0, 37.0], [870.0, 680.5], [871.0, 513.6], [880.0, 709.5], [894.0, 502.5], [893.0, 399.5], [895.0, 608.0], [890.0, 359.5496453900709], [891.0, 562.2], [888.0, 283.6666666666667], [889.0, 368.155172413793], [881.0, 745.875], [882.0, 561.0], [883.0, 1012.0], [884.0, 1011.0], [885.0, 640.0], [886.0, 561.727722772277], [872.0, 722.0], [873.0, 541.25], [874.0, 446.6], [875.0, 38.666666666666664], [877.0, 742.0], [878.0, 518.6666666666666], [901.0, 274.5681818181818], [896.0, 504.0], [897.0, 471.3333333333333], [898.0, 468.2], [899.0, 90.63520285577005], [903.0, 140.39684684684678], [902.0, 467.4], [920.0, 41.75], [922.0, 3.0], [921.0, 3.0], [910.0, 92.89265185789519], [906.0, 18.0], [904.0, 582.0], [911.0, 107.0], [912.0, 354.0], [915.0, 3.0], [913.0, 5.0], [919.0, 3.5], [918.0, 3.0], [923.0, 89.90868389142815], [925.0, 636.0], [924.0, 1531.1375661375653], [926.0, 1480.4065420560746], [932.0, 522.0], [930.0, 248.13043478260872], [929.0, 296.84195402298843], [933.0, 915.5], [934.0, 363.5], [935.0, 232.75], [937.0, 176.21951219512198], [936.0, 123.4], [939.0, 668.2083333333334], [938.0, 580.6037735849058], [941.0, 1032.0], [943.0, 639.0], [942.0, 1270.0], [944.0, 906.0], [946.0, 25.0], [945.0, 1841.0434782608693], [958.0, 553.0], [957.0, 554.0], [959.0, 475.6], [955.0, 245.2], [954.0, 281.0], [953.0, 560.0], [952.0, 283.0], [956.0, 303.5], [947.0, 1397.5058823529416], [948.0, 644.0], [949.0, 1786.0], [951.0, 696.75], [950.0, 1398.8], [966.0, 456.79681274900383], [971.0, 248.12500000000003], [964.0, 500.5], [960.0, 340.33333333333337], [961.0, 543.0], [963.0, 538.0], [962.0, 186.66666666666666], [972.0, 423.875], [974.0, 529.0], [973.0, 527.6666666666667], [975.0, 315.8571428571429], [965.0, 530.4705882352941], [967.0, 274.2714617169373], [984.0, 596.0], [985.0, 212.0], [986.0, 285.3333333333333], [987.0, 305.5], [988.0, 546.4], [990.0, 261.5], [989.0, 321.22222222222223], [991.0, 542.9599999999999], [976.0, 470.625], [977.0, 489.2], [978.0, 348.75], [979.0, 323.0], [980.0, 184.7619047619048], [981.0, 396.33333333333337], [982.0, 351.0], [983.0, 466.8], [968.0, 304.4242424242424], [969.0, 509.0], [970.0, 278.6666666666667], [992.0, 716.2142857142858], [993.0, 361.0], [994.0, 253.0], [995.0, 182.66991773386476], [997.0, 201.4446477584631], [998.0, 166.15087719298245], [999.0, 309.92878486055724], [996.0, 305.7692307692306]], "isOverall": false, "label": "HTTP Request", "isController": false}, {"data": [[767.2779236805516, 53.01434944943367]], "isOverall": false, "label": "HTTP Request-Aggregated", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 999.0, "title": "Time VS Threads"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    axisLabel: "Number of active threads",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average response times in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: { noColumns: 2,show: true, container: '#legendTimeVsThreads' },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s: At %x.2 active threads, Average response time was %y.2 ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesTimeVsThreads"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotTimesVsThreads"), dataset, options);
            // setup overview
            $.plot($("#overviewTimesVsThreads"), dataset, prepareOverviewOptions(options));
        }
};

// Time vs threads
function refreshTimeVsThreads(){
    var infos = timeVsThreadsInfos;
    prepareSeries(infos.data);
    if(isGraph($("#flotTimesVsThreads"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTimeVsThreads");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTimesVsThreads", "#overviewTimesVsThreads");
        $('#footerTimeVsThreads .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var bytesThroughputOverTimeInfos = {
        data : {"result": {"minY": 131003.95, "minX": 1.50503346E12, "maxY": 1141064.45, "series": [{"data": [[1.50503352E12, 1141064.45], [1.50503358E12, 561981.3333333334], [1.50503346E12, 140488.11666666667]], "isOverall": false, "label": "Bytes received per second", "isController": false}, {"data": [[1.50503352E12, 1076160.8333333333], [1.50503358E12, 534851.2], [1.50503346E12, 131003.95]], "isOverall": false, "label": "Bytes sent per second", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.50503358E12, "title": "Bytes Throughput Over Time"}},
        getOptions : function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity) ,
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Bytes/sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendBytesThroughputOverTime'
                },
                selection: {
                    mode: "xy"
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y"
                }
            };
        },
        createGraph : function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesBytesThroughputOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotBytesThroughputOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewBytesThroughputOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Bytes throughput Over Time
function refreshBytesThroughputOverTime(fixTimestamps) {
    var infos = bytesThroughputOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotBytesThroughputOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesBytesThroughputOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotBytesThroughputOverTime", "#overviewBytesThroughputOverTime");
        $('#footerBytesThroughputOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var responseTimesOverTimeInfos = {
        data: {"result": {"minY": 20.051409625705137, "minX": 1.50503346E12, "maxY": 210.39789228388145, "series": [{"data": [[1.50503352E12, 50.05844179408855], [1.50503358E12, 20.051409625705137], [1.50503346E12, 210.39789228388145]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.50503358E12, "title": "Response Time Over Time"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Response time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average response time was %y ms"
                }
            };
        },
        createGraph: function() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Times Over Time
function refreshResponseTimeOverTime(fixTimestamps) {
    var infos = responseTimesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotResponseTimesOverTime"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesResponseTimesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimesOverTime", "#overviewResponseTimesOverTime");
        $('#footerResponseTimesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var latenciesOverTimeInfos = {
        data: {"result": {"minY": 20.049194991055217, "minX": 1.50503346E12, "maxY": 209.9131175764754, "series": [{"data": [[1.50503352E12, 49.40658428131955], [1.50503358E12, 20.049194991055217], [1.50503346E12, 209.9131175764754]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.50503358E12, "title": "Latencies Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Response latencies in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendLatenciesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average latency was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesLatenciesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotLatenciesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewLatenciesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Latencies Over Time
function refreshLatenciesOverTime(fixTimestamps) {
    var infos = latenciesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotLatenciesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesLatenciesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotLatenciesOverTime", "#overviewLatenciesOverTime");
        $('#footerLatenciesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var connectTimeOverTimeInfos = {
        data: {"result": {"minY": 0.3260157217558811, "minX": 1.50503346E12, "maxY": 5.1794341164809055, "series": [{"data": [[1.50503352E12, 1.0820793725677438], [1.50503358E12, 0.3260157217558811], [1.50503346E12, 5.1794341164809055]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.50503358E12, "title": "Connect Time Over Time"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getConnectTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Average Connect Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendConnectTimeOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Average connect time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesConnectTimeOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotConnectTimeOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewConnectTimeOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Connect Time Over Time
function refreshConnectTimeOverTime(fixTimestamps) {
    var infos = connectTimeOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotConnectTimeOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesConnectTimeOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotConnectTimeOverTime", "#overviewConnectTimeOverTime");
        $('#footerConnectTimeOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var responseTimePercentilesOverTimeInfos = {
        data: {"result": {"minY": 0.0, "minX": 1.50503346E12, "maxY": 3047.0, "series": [{"data": [[1.50503352E12, 3047.0], [1.50503358E12, 306.0], [1.50503346E12, 2888.0]], "isOverall": false, "label": "Max", "isController": false}, {"data": [[1.50503352E12, 0.0], [1.50503358E12, 0.0], [1.50503346E12, 0.0]], "isOverall": false, "label": "Min", "isController": false}, {"data": [[1.50503352E12, 30.0], [1.50503358E12, 54.0], [1.50503346E12, 251.0]], "isOverall": false, "label": "90th percentile", "isController": false}, {"data": [[1.50503352E12, 156.0], [1.50503358E12, 155.0], [1.50503346E12, 1915.9800000000032]], "isOverall": false, "label": "99th percentile", "isController": false}, {"data": [[1.50503352E12, 128.0], [1.50503358E12, 103.0], [1.50503346E12, 644.0]], "isOverall": false, "label": "95th percentile", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.50503358E12, "title": "Response Time Percentiles Over Time (successful requests only)"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true,
                        fill: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Response Time in ms",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: '#legendResponseTimePercentilesOverTime'
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s : at %x Response time was %y ms"
                }
            };
        },
        createGraph: function () {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesResponseTimePercentilesOverTime"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotResponseTimePercentilesOverTime"), dataset, options);
            // setup overview
            $.plot($("#overviewResponseTimePercentilesOverTime"), dataset, prepareOverviewOptions(options));
        }
};

// Response Time Percentiles Over Time
function refreshResponseTimePercentilesOverTime(fixTimestamps) {
    var infos = responseTimePercentilesOverTimeInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotResponseTimePercentilesOverTime"))) {
        infos.createGraph();
    }else {
        var choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimePercentilesOverTime", "#overviewResponseTimePercentilesOverTime");
        $('#footerResponseTimePercentilesOverTime .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var responseTimeVsRequestInfos = {
    data: {"result": {"minY": 5.0, "minX": 807.0, "maxY": 540.5, "series": [{"data": [[807.0, 5.0], [875.0, 17.0], [958.0, 114.0]], "isOverall": false, "label": "Successes", "isController": false}, {"data": [[807.0, 71.0], [958.0, 540.5]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 958.0, "title": "Response Time Vs Request"}},
    getOptions: function() {
        return {
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Response Time (ms)",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: {
                noColumns: 2,
                show: true,
                container: '#legendResponseTimeVsRequest'
            },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesResponseTimeVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotResponseTimeVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewResponseTimeVsRequest"), dataset, prepareOverviewOptions(options));

    }
};

// Response Time vs Request
function refreshResponseTimeVsRequest() {
    var infos = responseTimeVsRequestInfos;
    prepareSeries(infos.data);
    if (isGraph($("#flotResponseTimeVsRequest"))){
        infos.create();
    }else{
        var choiceContainer = $("#choicesResponseTimeVsRequest");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotResponseTimeVsRequest", "#overviewResponseTimeVsRequest");
        $('#footerResponseRimeVsRequest .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};


var latenciesVsRequestInfos = {
    data: {"result": {"minY": 0.0, "minX": 807.0, "maxY": 114.0, "series": [{"data": [[807.0, 5.0], [875.0, 17.0], [958.0, 114.0]], "isOverall": false, "label": "Successes", "isController": false}, {"data": [[807.0, 0.0], [958.0, 0.0]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 958.0, "title": "Latencies Vs Request"}},
    getOptions: function() {
        return{
            series: {
                lines: {
                    show: false
                },
                points: {
                    show: true
                }
            },
            xaxis: {
                axisLabel: "Global number of requests per second",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            yaxis: {
                axisLabel: "Median Latency (ms)",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 12,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 20,
            },
            legend: { noColumns: 2,show: true, container: '#legendLatencyVsRequest' },
            selection: {
                mode: 'xy'
            },
            grid: {
                hoverable: true // IMPORTANT! this is needed for tooltip to work
            },
            tooltip: true,
            tooltipOpts: {
                content: "%s : Median response time at %x req/s was %y ms"
            },
            colors: ["#9ACD32", "#FF6347"]
        };
    },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesLatencyVsRequest"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotLatenciesVsRequest"), dataset, options);
        // setup overview
        $.plot($("#overviewLatenciesVsRequest"), dataset, prepareOverviewOptions(options));
    }
};

// Latencies vs Request
function refreshLatenciesVsRequest() {
        var infos = latenciesVsRequestInfos;
        prepareSeries(infos.data);
        if(isGraph($("#flotLatenciesVsRequest"))){
            infos.createGraph();
        }else{
            var choiceContainer = $("#choicesLatencyVsRequest");
            createLegend(choiceContainer, infos);
            infos.createGraph();
            setGraphZoomable("#flotLatenciesVsRequest", "#overviewLatenciesVsRequest");
            $('#footerLatenciesVsRequest .legendColorBox > div').each(function(i){
                $(this).clone().prependTo(choiceContainer.find("li").eq(i));
            });
        }
};

var hitsPerSecondInfos = {
        data: {"result": {"minY": 969.8, "minX": 1.50503346E12, "maxY": 7796.066666666667, "series": [{"data": [[1.50503352E12, 7796.066666666667], [1.50503358E12, 3875.733333333333], [1.50503346E12, 969.8]], "isOverall": false, "label": "hitsPerSecond", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.50503358E12, "title": "Hits Per Second"}},
        getOptions: function() {
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of hits / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendHitsPerSecond"
                },
                selection: {
                    mode : 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y.2 hits/sec"
                }
            };
        },
        createGraph: function createGraph() {
            var data = this.data;
            var dataset = prepareData(data.result.series, $("#choicesHitsPerSecond"));
            var options = this.getOptions();
            prepareOptions(options, data);
            $.plot($("#flotHitsPerSecond"), dataset, options);
            // setup overview
            $.plot($("#overviewHitsPerSecond"), dataset, prepareOverviewOptions(options));
        }
};

// Hits per second
function refreshHitsPerSecond(fixTimestamps) {
    var infos = hitsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if (isGraph($("#flotHitsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesHitsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotHitsPerSecond", "#overviewHitsPerSecond");
        $('#footerHitsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
}

var codesPerSecondInfos = {
        data: {"result": {"minY": 0.8, "minX": 1.50503346E12, "maxY": 7803.383333333333, "series": [{"data": [[1.50503352E12, 7803.383333333333], [1.50503358E12, 3875.733333333333], [1.50503346E12, 957.5833333333334]], "isOverall": false, "label": "200", "isController": false}, {"data": [[1.50503352E12, 4.1], [1.50503346E12, 0.8]], "isOverall": false, "label": "Non HTTP response code: java.net.SocketException", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.50503358E12, "title": "Codes Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of responses/sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendCodesPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "Number of Response Codes %s at %x was %y.2 responses / sec"
                }
            };
        },
    createGraph: function() {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesCodesPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotCodesPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewCodesPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Codes per second
function refreshCodesPerSecond(fixTimestamps) {
    var infos = codesPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotCodesPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesCodesPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotCodesPerSecond", "#overviewCodesPerSecond");
        $('#footerCodesPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

var transactionsPerSecondInfos = {
        data: {"result": {"minY": 0.8, "minX": 1.50503346E12, "maxY": 7803.383333333333, "series": [{"data": [[1.50503352E12, 7803.383333333333], [1.50503358E12, 3875.733333333333], [1.50503346E12, 957.5833333333334]], "isOverall": false, "label": "HTTP Request-success", "isController": false}, {"data": [[1.50503352E12, 4.1], [1.50503346E12, 0.8]], "isOverall": false, "label": "HTTP Request-failure", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.50503358E12, "title": "Transactions Per Second"}},
        getOptions: function(){
            return {
                series: {
                    lines: {
                        show: true
                    },
                    points: {
                        show: true
                    }
                },
                xaxis: {
                    mode: "time",
                    timeformat: "%H:%M:%S",
                    axisLabel: getElapsedTimeLabel(this.data.result.granularity),
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20,
                },
                yaxis: {
                    axisLabel: "Number of transactions / sec",
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: 'Verdana, Arial',
                    axisLabelPadding: 20
                },
                legend: {
                    noColumns: 2,
                    show: true,
                    container: "#legendTransactionsPerSecond"
                },
                selection: {
                    mode: 'xy'
                },
                grid: {
                    hoverable: true // IMPORTANT! this is needed for tooltip to
                                    // work
                },
                tooltip: true,
                tooltipOpts: {
                    content: "%s at %x was %y transactions / sec"
                }
            };
        },
    createGraph: function () {
        var data = this.data;
        var dataset = prepareData(data.result.series, $("#choicesTransactionsPerSecond"));
        var options = this.getOptions();
        prepareOptions(options, data);
        $.plot($("#flotTransactionsPerSecond"), dataset, options);
        // setup overview
        $.plot($("#overviewTransactionsPerSecond"), dataset, prepareOverviewOptions(options));
    }
};

// Transactions per second
function refreshTransactionsPerSecond(fixTimestamps) {
    var infos = transactionsPerSecondInfos;
    prepareSeries(infos.data);
    if(fixTimestamps) {
        fixTimeStamps(infos.data.result.series, 7200000);
    }
    if(isGraph($("#flotTransactionsPerSecond"))){
        infos.createGraph();
    }else{
        var choiceContainer = $("#choicesTransactionsPerSecond");
        createLegend(choiceContainer, infos);
        infos.createGraph();
        setGraphZoomable("#flotTransactionsPerSecond", "#overviewTransactionsPerSecond");
        $('#footerTransactionsPerSecond .legendColorBox > div').each(function(i){
            $(this).clone().prependTo(choiceContainer.find("li").eq(i));
        });
    }
};

// Collapse the graph matching the specified DOM element depending the collapsed
// status
function collapse(elem, collapsed){
    if(collapsed){
        $(elem).parent().find(".fa-chevron-up").removeClass("fa-chevron-up").addClass("fa-chevron-down");
    } else {
        $(elem).parent().find(".fa-chevron-down").removeClass("fa-chevron-down").addClass("fa-chevron-up");
        if (elem.id == "bodyBytesThroughputOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshBytesThroughputOverTime(true);
            }
            document.location.href="#bytesThroughputOverTime";
        } else if (elem.id == "bodyLatenciesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesOverTime(true);
            }
            document.location.href="#latenciesOverTime";
        } else if (elem.id == "bodyConnectTimeOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshConnectTimeOverTime(true);
            }
            document.location.href="#connectTimeOverTime";
        } else if (elem.id == "bodyResponseTimePercentilesOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimePercentilesOverTime(true);
            }
            document.location.href="#responseTimePercentilesOverTime";
        } else if (elem.id == "bodyResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeDistribution();
            }
            document.location.href="#responseTimeDistribution" ;
        } else if (elem.id == "bodySyntheticResponseTimeDistribution") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshSyntheticResponseTimeDistribution();
            }
            document.location.href="#syntheticResponseTimeDistribution" ;
        } else if (elem.id == "bodyActiveThreadsOverTime") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshActiveThreadsOverTime(true);
            }
            document.location.href="#activeThreadsOverTime";
        } else if (elem.id == "bodyTimeVsThreads") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTimeVsThreads();
            }
            document.location.href="#timeVsThreads" ;
        } else if (elem.id == "bodyCodesPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshCodesPerSecond(true);
            }
            document.location.href="#codesPerSecond";
        } else if (elem.id == "bodyTransactionsPerSecond") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshTransactionsPerSecond(true);
            }
            document.location.href="#transactionsPerSecond";
        } else if (elem.id == "bodyResponseTimeVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshResponseTimeVsRequest();
            }
            document.location.href="#responseTimeVsRequest";
        } else if (elem.id == "bodyLatenciesVsRequest") {
            if (isGraph($(elem).find('.flot-chart-content')) == false) {
                refreshLatenciesVsRequest();
            }
            document.location.href="#latencyVsRequest";
        }
    }
}

// Collapse
$(function() {
        $('.collapse').on('shown.bs.collapse', function(){
            collapse(this, false);
        }).on('hidden.bs.collapse', function(){
            collapse(this, true);
        });
});

$(function() {
    $(".glyphicon").mousedown( function(event){
        var tmp = $('.in:not(ul)');
        tmp.parent().parent().parent().find(".fa-chevron-up").removeClass("fa-chevron-down").addClass("fa-chevron-down");
        tmp.removeClass("in");
        tmp.addClass("out");
    });
});

/*
 * Activates or deactivates all series of the specified graph (represented by id parameter)
 * depending on checked argument.
 */
function toggleAll(id, checked){
    var placeholder = document.getElementById(id);

    var cases = $(placeholder).find(':checkbox');
    cases.prop('checked', checked);
    $(cases).parent().children().children().toggleClass("legend-disabled", !checked);

    var choiceContainer;
    if ( id == "choicesBytesThroughputOverTime"){
        choiceContainer = $("#choicesBytesThroughputOverTime");
        refreshBytesThroughputOverTime(false);
    } else if(id == "choicesResponseTimesOverTime"){
        choiceContainer = $("#choicesResponseTimesOverTime");
        refreshResponseTimeOverTime(false);
    } else if ( id == "choicesLatenciesOverTime"){
        choiceContainer = $("#choicesLatenciesOverTime");
        refreshLatenciesOverTime(false);
    } else if ( id == "choicesConnectTimeOverTime"){
        choiceContainer = $("#choicesConnectTimeOverTime");
        refreshConnectTimeOverTime(false);
    } else if ( id == "responseTimePercentilesOverTime"){
        choiceContainer = $("#choicesResponseTimePercentilesOverTime");
        refreshResponseTimePercentilesOverTime(false);
    } else if ( id == "choicesResponseTimePercentiles"){
        choiceContainer = $("#choicesResponseTimePercentiles");
        refreshResponseTimePercentiles();
    } else if(id == "choicesActiveThreadsOverTime"){
        choiceContainer = $("#choicesActiveThreadsOverTime");
        refreshActiveThreadsOverTime(false);
    } else if ( id == "choicesTimeVsThreads"){
        choiceContainer = $("#choicesTimeVsThreads");
        refreshTimeVsThreads();
    } else if ( id == "choicesSyntheticResponseTimeDistribution"){
        choiceContainer = $("#choicesSyntheticResponseTimeDistribution");
        refreshSyntheticResponseTimeDistribution();
    } else if ( id == "choicesResponseTimeDistribution"){
        choiceContainer = $("#choicesResponseTimeDistribution");
        refreshResponseTimeDistribution();
    } else if ( id == "choicesHitsPerSecond"){
        choiceContainer = $("#choicesHitsPerSecond");
        refreshHitsPerSecond(false);
    } else if(id == "choicesCodesPerSecond"){
        choiceContainer = $("#choicesCodesPerSecond");
        refreshCodesPerSecond(false);
    } else if ( id == "choicesTransactionsPerSecond"){
        choiceContainer = $("#choicesTransactionsPerSecond");
        refreshTransactionsPerSecond(false);
    } else if ( id == "choicesResponseTimeVsRequest"){
        choiceContainer = $("#choicesResponseTimeVsRequest");
        refreshResponseTimeVsRequest();
    } else if ( id == "choicesLatencyVsRequest"){
        choiceContainer = $("#choicesLatencyVsRequest");
        refreshLatenciesVsRequest();
    }
    var color = checked ? "black" : "#818181";
    choiceContainer.find("label").each(function(){
        this.style.color = color;
    });
}

// Unchecks all boxes for "Hide all samples" functionality
function uncheckAll(id){
    toggleAll(id, false);
}

// Checks all boxes for "Show all samples" functionality
function checkAll(id){
    toggleAll(id, true);
}

// Prepares data to be consumed by plot plugins
function prepareData(series, choiceContainer, customizeSeries){
    var datasets = [];

    // Add only selected series to the data set
    choiceContainer.find("input:checked").each(function (index, item) {
        var key = $(item).attr("name");
        var i = 0;
        var size = series.length;
        while(i < size && series[i].label != key)
            i++;
        if(i < size){
            var currentSeries = series[i];
            datasets.push(currentSeries);
            if(customizeSeries)
                customizeSeries(currentSeries);
        }
    });
    return datasets;
}

/*
 * Ignore case comparator
 */
function sortAlphaCaseless(a,b){
    return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
};

/*
 * Creates a legend in the specified element with graph information
 */
function createLegend(choiceContainer, infos) {
    // Sort series by name
    var keys = [];
    $.each(infos.data.result.series, function(index, series){
        keys.push(series.label);
    });
    keys.sort(sortAlphaCaseless);

    // Create list of series with support of activation/deactivation
    $.each(keys, function(index, key) {
        var id = choiceContainer.attr('id') + index;
        $('<li />')
            .append($('<input id="' + id + '" name="' + key + '" type="checkbox" checked="checked" hidden />'))
            .append($('<label />', { 'text': key , 'for': id }))
            .appendTo(choiceContainer);
    });
    choiceContainer.find("label").click( function(){
        if (this.style.color !== "rgb(129, 129, 129)" ){
            this.style.color="#818181";
        }else {
            this.style.color="black";
        }
        $(this).parent().children().children().toggleClass("legend-disabled");
    });
    choiceContainer.find("label").mousedown( function(event){
        event.preventDefault();
    });
    choiceContainer.find("label").mouseenter(function(){
        this.style.cursor="pointer";
    });

    // Recreate graphe on series activation toggle
    choiceContainer.find("input").click(function(){
        infos.createGraph();
    });
}
