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
        data: {"result": {"minY": 0.0, "minX": 0.0, "maxY": 1571.0, "series": [{"data": [[0.0, 0.0], [0.1, 0.0], [0.2, 0.0], [0.3, 0.0], [0.4, 0.0], [0.5, 0.0], [0.6, 0.0], [0.7, 0.0], [0.8, 1.0], [0.9, 1.0], [1.0, 1.0], [1.1, 1.0], [1.2, 1.0], [1.3, 1.0], [1.4, 1.0], [1.5, 1.0], [1.6, 1.0], [1.7, 1.0], [1.8, 1.0], [1.9, 1.0], [2.0, 1.0], [2.1, 1.0], [2.2, 1.0], [2.3, 1.0], [2.4, 1.0], [2.5, 1.0], [2.6, 1.0], [2.7, 1.0], [2.8, 1.0], [2.9, 1.0], [3.0, 1.0], [3.1, 1.0], [3.2, 1.0], [3.3, 1.0], [3.4, 1.0], [3.5, 1.0], [3.6, 1.0], [3.7, 1.0], [3.8, 1.0], [3.9, 1.0], [4.0, 1.0], [4.1, 2.0], [4.2, 2.0], [4.3, 2.0], [4.4, 2.0], [4.5, 2.0], [4.6, 2.0], [4.7, 2.0], [4.8, 2.0], [4.9, 2.0], [5.0, 2.0], [5.1, 2.0], [5.2, 2.0], [5.3, 2.0], [5.4, 2.0], [5.5, 2.0], [5.6, 2.0], [5.7, 2.0], [5.8, 2.0], [5.9, 2.0], [6.0, 2.0], [6.1, 2.0], [6.2, 2.0], [6.3, 2.0], [6.4, 2.0], [6.5, 2.0], [6.6, 2.0], [6.7, 2.0], [6.8, 2.0], [6.9, 2.0], [7.0, 2.0], [7.1, 2.0], [7.2, 2.0], [7.3, 2.0], [7.4, 2.0], [7.5, 2.0], [7.6, 2.0], [7.7, 2.0], [7.8, 2.0], [7.9, 2.0], [8.0, 3.0], [8.1, 3.0], [8.2, 3.0], [8.3, 3.0], [8.4, 3.0], [8.5, 3.0], [8.6, 3.0], [8.7, 3.0], [8.8, 3.0], [8.9, 3.0], [9.0, 3.0], [9.1, 3.0], [9.2, 3.0], [9.3, 3.0], [9.4, 3.0], [9.5, 3.0], [9.6, 3.0], [9.7, 3.0], [9.8, 3.0], [9.9, 3.0], [10.0, 3.0], [10.1, 3.0], [10.2, 3.0], [10.3, 3.0], [10.4, 3.0], [10.5, 3.0], [10.6, 3.0], [10.7, 3.0], [10.8, 3.0], [10.9, 3.0], [11.0, 3.0], [11.1, 3.0], [11.2, 3.0], [11.3, 3.0], [11.4, 3.0], [11.5, 3.0], [11.6, 4.0], [11.7, 4.0], [11.8, 4.0], [11.9, 4.0], [12.0, 4.0], [12.1, 4.0], [12.2, 4.0], [12.3, 4.0], [12.4, 4.0], [12.5, 4.0], [12.6, 4.0], [12.7, 4.0], [12.8, 4.0], [12.9, 4.0], [13.0, 4.0], [13.1, 4.0], [13.2, 4.0], [13.3, 4.0], [13.4, 4.0], [13.5, 4.0], [13.6, 4.0], [13.7, 4.0], [13.8, 4.0], [13.9, 4.0], [14.0, 4.0], [14.1, 4.0], [14.2, 4.0], [14.3, 4.0], [14.4, 4.0], [14.5, 4.0], [14.6, 4.0], [14.7, 4.0], [14.8, 5.0], [14.9, 5.0], [15.0, 5.0], [15.1, 5.0], [15.2, 5.0], [15.3, 5.0], [15.4, 5.0], [15.5, 5.0], [15.6, 5.0], [15.7, 5.0], [15.8, 5.0], [15.9, 5.0], [16.0, 5.0], [16.1, 5.0], [16.2, 5.0], [16.3, 5.0], [16.4, 5.0], [16.5, 5.0], [16.6, 5.0], [16.7, 5.0], [16.8, 5.0], [16.9, 5.0], [17.0, 5.0], [17.1, 5.0], [17.2, 5.0], [17.3, 5.0], [17.4, 5.0], [17.5, 5.0], [17.6, 5.0], [17.7, 5.0], [17.8, 5.0], [17.9, 6.0], [18.0, 6.0], [18.1, 6.0], [18.2, 6.0], [18.3, 6.0], [18.4, 6.0], [18.5, 6.0], [18.6, 6.0], [18.7, 6.0], [18.8, 6.0], [18.9, 6.0], [19.0, 6.0], [19.1, 6.0], [19.2, 6.0], [19.3, 6.0], [19.4, 6.0], [19.5, 6.0], [19.6, 6.0], [19.7, 6.0], [19.8, 6.0], [19.9, 6.0], [20.0, 6.0], [20.1, 6.0], [20.2, 6.0], [20.3, 6.0], [20.4, 6.0], [20.5, 6.0], [20.6, 6.0], [20.7, 6.0], [20.8, 7.0], [20.9, 7.0], [21.0, 7.0], [21.1, 7.0], [21.2, 7.0], [21.3, 7.0], [21.4, 7.0], [21.5, 7.0], [21.6, 7.0], [21.7, 7.0], [21.8, 7.0], [21.9, 7.0], [22.0, 7.0], [22.1, 7.0], [22.2, 7.0], [22.3, 7.0], [22.4, 7.0], [22.5, 7.0], [22.6, 7.0], [22.7, 7.0], [22.8, 7.0], [22.9, 7.0], [23.0, 7.0], [23.1, 7.0], [23.2, 7.0], [23.3, 7.0], [23.4, 7.0], [23.5, 8.0], [23.6, 8.0], [23.7, 8.0], [23.8, 8.0], [23.9, 8.0], [24.0, 8.0], [24.1, 8.0], [24.2, 8.0], [24.3, 8.0], [24.4, 8.0], [24.5, 8.0], [24.6, 8.0], [24.7, 8.0], [24.8, 8.0], [24.9, 8.0], [25.0, 8.0], [25.1, 8.0], [25.2, 8.0], [25.3, 8.0], [25.4, 8.0], [25.5, 8.0], [25.6, 8.0], [25.7, 8.0], [25.8, 8.0], [25.9, 8.0], [26.0, 9.0], [26.1, 9.0], [26.2, 9.0], [26.3, 9.0], [26.4, 9.0], [26.5, 9.0], [26.6, 9.0], [26.7, 9.0], [26.8, 9.0], [26.9, 9.0], [27.0, 9.0], [27.1, 9.0], [27.2, 9.0], [27.3, 9.0], [27.4, 9.0], [27.5, 9.0], [27.6, 9.0], [27.7, 9.0], [27.8, 9.0], [27.9, 9.0], [28.0, 9.0], [28.1, 10.0], [28.2, 10.0], [28.3, 10.0], [28.4, 10.0], [28.5, 10.0], [28.6, 10.0], [28.7, 10.0], [28.8, 10.0], [28.9, 10.0], [29.0, 10.0], [29.1, 10.0], [29.2, 10.0], [29.3, 10.0], [29.4, 10.0], [29.5, 10.0], [29.6, 10.0], [29.7, 10.0], [29.8, 10.0], [29.9, 11.0], [30.0, 11.0], [30.1, 11.0], [30.2, 11.0], [30.3, 11.0], [30.4, 11.0], [30.5, 11.0], [30.6, 11.0], [30.7, 11.0], [30.8, 11.0], [30.9, 11.0], [31.0, 11.0], [31.1, 11.0], [31.2, 11.0], [31.3, 11.0], [31.4, 11.0], [31.5, 11.0], [31.6, 12.0], [31.7, 12.0], [31.8, 12.0], [31.9, 12.0], [32.0, 12.0], [32.1, 12.0], [32.2, 12.0], [32.3, 12.0], [32.4, 12.0], [32.5, 12.0], [32.6, 12.0], [32.7, 12.0], [32.8, 12.0], [32.9, 12.0], [33.0, 12.0], [33.1, 12.0], [33.2, 12.0], [33.3, 12.0], [33.4, 12.0], [33.5, 13.0], [33.6, 13.0], [33.7, 13.0], [33.8, 13.0], [33.9, 13.0], [34.0, 13.0], [34.1, 13.0], [34.2, 13.0], [34.3, 13.0], [34.4, 13.0], [34.5, 13.0], [34.6, 13.0], [34.7, 13.0], [34.8, 13.0], [34.9, 13.0], [35.0, 13.0], [35.1, 13.0], [35.2, 14.0], [35.3, 14.0], [35.4, 14.0], [35.5, 14.0], [35.6, 14.0], [35.7, 14.0], [35.8, 14.0], [35.9, 14.0], [36.0, 14.0], [36.1, 14.0], [36.2, 14.0], [36.3, 14.0], [36.4, 14.0], [36.5, 14.0], [36.6, 14.0], [36.7, 14.0], [36.8, 14.0], [36.9, 15.0], [37.0, 15.0], [37.1, 15.0], [37.2, 15.0], [37.3, 15.0], [37.4, 15.0], [37.5, 15.0], [37.6, 15.0], [37.7, 15.0], [37.8, 15.0], [37.9, 15.0], [38.0, 15.0], [38.1, 15.0], [38.2, 15.0], [38.3, 15.0], [38.4, 15.0], [38.5, 15.0], [38.6, 16.0], [38.7, 16.0], [38.8, 16.0], [38.9, 16.0], [39.0, 16.0], [39.1, 16.0], [39.2, 16.0], [39.3, 16.0], [39.4, 16.0], [39.5, 16.0], [39.6, 16.0], [39.7, 16.0], [39.8, 16.0], [39.9, 16.0], [40.0, 16.0], [40.1, 16.0], [40.2, 16.0], [40.3, 17.0], [40.4, 17.0], [40.5, 17.0], [40.6, 17.0], [40.7, 17.0], [40.8, 17.0], [40.9, 17.0], [41.0, 17.0], [41.1, 17.0], [41.2, 17.0], [41.3, 17.0], [41.4, 17.0], [41.5, 17.0], [41.6, 17.0], [41.7, 17.0], [41.8, 17.0], [41.9, 18.0], [42.0, 18.0], [42.1, 18.0], [42.2, 18.0], [42.3, 18.0], [42.4, 18.0], [42.5, 18.0], [42.6, 18.0], [42.7, 18.0], [42.8, 18.0], [42.9, 18.0], [43.0, 18.0], [43.1, 18.0], [43.2, 18.0], [43.3, 19.0], [43.4, 19.0], [43.5, 19.0], [43.6, 19.0], [43.7, 19.0], [43.8, 19.0], [43.9, 19.0], [44.0, 19.0], [44.1, 19.0], [44.2, 19.0], [44.3, 19.0], [44.4, 19.0], [44.5, 19.0], [44.6, 19.0], [44.7, 19.0], [44.8, 20.0], [44.9, 20.0], [45.0, 20.0], [45.1, 20.0], [45.2, 20.0], [45.3, 20.0], [45.4, 20.0], [45.5, 20.0], [45.6, 20.0], [45.7, 20.0], [45.8, 20.0], [45.9, 20.0], [46.0, 20.0], [46.1, 21.0], [46.2, 21.0], [46.3, 21.0], [46.4, 21.0], [46.5, 21.0], [46.6, 21.0], [46.7, 21.0], [46.8, 21.0], [46.9, 21.0], [47.0, 21.0], [47.1, 21.0], [47.2, 21.0], [47.3, 22.0], [47.4, 22.0], [47.5, 22.0], [47.6, 22.0], [47.7, 22.0], [47.8, 22.0], [47.9, 22.0], [48.0, 22.0], [48.1, 22.0], [48.2, 22.0], [48.3, 22.0], [48.4, 23.0], [48.5, 23.0], [48.6, 23.0], [48.7, 23.0], [48.8, 23.0], [48.9, 23.0], [49.0, 23.0], [49.1, 23.0], [49.2, 23.0], [49.3, 23.0], [49.4, 24.0], [49.5, 24.0], [49.6, 24.0], [49.7, 24.0], [49.8, 24.0], [49.9, 24.0], [50.0, 24.0], [50.1, 24.0], [50.2, 24.0], [50.3, 25.0], [50.4, 25.0], [50.5, 25.0], [50.6, 25.0], [50.7, 25.0], [50.8, 25.0], [50.9, 25.0], [51.0, 25.0], [51.1, 25.0], [51.2, 26.0], [51.3, 26.0], [51.4, 26.0], [51.5, 26.0], [51.6, 26.0], [51.7, 26.0], [51.8, 26.0], [51.9, 26.0], [52.0, 26.0], [52.1, 27.0], [52.2, 27.0], [52.3, 27.0], [52.4, 27.0], [52.5, 27.0], [52.6, 27.0], [52.7, 27.0], [52.8, 27.0], [52.9, 28.0], [53.0, 28.0], [53.1, 28.0], [53.2, 28.0], [53.3, 28.0], [53.4, 28.0], [53.5, 28.0], [53.6, 29.0], [53.7, 29.0], [53.8, 29.0], [53.9, 29.0], [54.0, 29.0], [54.1, 29.0], [54.2, 30.0], [54.3, 30.0], [54.4, 30.0], [54.5, 30.0], [54.6, 30.0], [54.7, 30.0], [54.8, 31.0], [54.9, 31.0], [55.0, 31.0], [55.1, 31.0], [55.2, 31.0], [55.3, 31.0], [55.4, 32.0], [55.5, 32.0], [55.6, 32.0], [55.7, 32.0], [55.8, 32.0], [55.9, 33.0], [56.0, 33.0], [56.1, 33.0], [56.2, 33.0], [56.3, 33.0], [56.4, 34.0], [56.5, 34.0], [56.6, 34.0], [56.7, 34.0], [56.8, 35.0], [56.9, 35.0], [57.0, 35.0], [57.1, 35.0], [57.2, 35.0], [57.3, 36.0], [57.4, 36.0], [57.5, 36.0], [57.6, 36.0], [57.7, 36.0], [57.8, 37.0], [57.9, 37.0], [58.0, 37.0], [58.1, 37.0], [58.2, 37.0], [58.3, 38.0], [58.4, 38.0], [58.5, 38.0], [58.6, 38.0], [58.7, 39.0], [58.8, 39.0], [58.9, 39.0], [59.0, 39.0], [59.1, 40.0], [59.2, 40.0], [59.3, 40.0], [59.4, 40.0], [59.5, 41.0], [59.6, 41.0], [59.7, 41.0], [59.8, 41.0], [59.9, 42.0], [60.0, 42.0], [60.1, 42.0], [60.2, 42.0], [60.3, 43.0], [60.4, 43.0], [60.5, 43.0], [60.6, 43.0], [60.7, 44.0], [60.8, 44.0], [60.9, 44.0], [61.0, 44.0], [61.1, 45.0], [61.2, 45.0], [61.3, 45.0], [61.4, 46.0], [61.5, 46.0], [61.6, 46.0], [61.7, 47.0], [61.8, 47.0], [61.9, 47.0], [62.0, 47.0], [62.1, 48.0], [62.2, 48.0], [62.3, 48.0], [62.4, 49.0], [62.5, 49.0], [62.6, 49.0], [62.7, 49.0], [62.8, 50.0], [62.9, 50.0], [63.0, 50.0], [63.1, 51.0], [63.2, 51.0], [63.3, 51.0], [63.4, 52.0], [63.5, 52.0], [63.6, 52.0], [63.7, 53.0], [63.8, 53.0], [63.9, 53.0], [64.0, 54.0], [64.1, 54.0], [64.2, 55.0], [64.3, 55.0], [64.4, 55.0], [64.5, 56.0], [64.6, 56.0], [64.7, 56.0], [64.8, 57.0], [64.9, 57.0], [65.0, 58.0], [65.1, 58.0], [65.2, 58.0], [65.3, 59.0], [65.4, 59.0], [65.5, 60.0], [65.6, 60.0], [65.7, 60.0], [65.8, 61.0], [65.9, 61.0], [66.0, 62.0], [66.1, 62.0], [66.2, 62.0], [66.3, 63.0], [66.4, 63.0], [66.5, 64.0], [66.6, 64.0], [66.7, 65.0], [66.8, 65.0], [66.9, 65.0], [67.0, 66.0], [67.1, 66.0], [67.2, 67.0], [67.3, 67.0], [67.4, 67.0], [67.5, 68.0], [67.6, 68.0], [67.7, 69.0], [67.8, 69.0], [67.9, 70.0], [68.0, 70.0], [68.1, 70.0], [68.2, 71.0], [68.3, 71.0], [68.4, 72.0], [68.5, 72.0], [68.6, 72.0], [68.7, 73.0], [68.8, 73.0], [68.9, 74.0], [69.0, 74.0], [69.1, 74.0], [69.2, 75.0], [69.3, 75.0], [69.4, 75.0], [69.5, 76.0], [69.6, 76.0], [69.7, 77.0], [69.8, 77.0], [69.9, 78.0], [70.0, 78.0], [70.1, 79.0], [70.2, 79.0], [70.3, 80.0], [70.4, 80.0], [70.5, 80.0], [70.6, 81.0], [70.7, 81.0], [70.8, 82.0], [70.9, 82.0], [71.0, 83.0], [71.1, 83.0], [71.2, 84.0], [71.3, 84.0], [71.4, 85.0], [71.5, 85.0], [71.6, 86.0], [71.7, 87.0], [71.8, 87.0], [71.9, 88.0], [72.0, 88.0], [72.1, 89.0], [72.2, 89.0], [72.3, 90.0], [72.4, 91.0], [72.5, 91.0], [72.6, 92.0], [72.7, 93.0], [72.8, 93.0], [72.9, 94.0], [73.0, 95.0], [73.1, 95.0], [73.2, 96.0], [73.3, 97.0], [73.4, 97.0], [73.5, 98.0], [73.6, 99.0], [73.7, 99.0], [73.8, 100.0], [73.9, 101.0], [74.0, 101.0], [74.1, 102.0], [74.2, 102.0], [74.3, 103.0], [74.4, 104.0], [74.5, 104.0], [74.6, 105.0], [74.7, 105.0], [74.8, 106.0], [74.9, 107.0], [75.0, 107.0], [75.1, 108.0], [75.2, 108.0], [75.3, 109.0], [75.4, 110.0], [75.5, 110.0], [75.6, 111.0], [75.7, 112.0], [75.8, 112.0], [75.9, 113.0], [76.0, 113.0], [76.1, 114.0], [76.2, 114.0], [76.3, 115.0], [76.4, 116.0], [76.5, 116.0], [76.6, 117.0], [76.7, 117.0], [76.8, 118.0], [76.9, 119.0], [77.0, 119.0], [77.1, 120.0], [77.2, 120.0], [77.3, 121.0], [77.4, 122.0], [77.5, 122.0], [77.6, 123.0], [77.7, 124.0], [77.8, 124.0], [77.9, 125.0], [78.0, 125.0], [78.1, 126.0], [78.2, 126.0], [78.3, 127.0], [78.4, 127.0], [78.5, 128.0], [78.6, 129.0], [78.7, 129.0], [78.8, 130.0], [78.9, 131.0], [79.0, 131.0], [79.1, 132.0], [79.2, 133.0], [79.3, 133.0], [79.4, 134.0], [79.5, 134.0], [79.6, 135.0], [79.7, 135.0], [79.8, 136.0], [79.9, 136.0], [80.0, 137.0], [80.1, 137.0], [80.2, 138.0], [80.3, 139.0], [80.4, 139.0], [80.5, 140.0], [80.6, 140.0], [80.7, 141.0], [80.8, 141.0], [80.9, 142.0], [81.0, 142.0], [81.1, 143.0], [81.2, 143.0], [81.3, 144.0], [81.4, 144.0], [81.5, 145.0], [81.6, 146.0], [81.7, 146.0], [81.8, 147.0], [81.9, 147.0], [82.0, 148.0], [82.1, 148.0], [82.2, 149.0], [82.3, 149.0], [82.4, 150.0], [82.5, 150.0], [82.6, 151.0], [82.7, 151.0], [82.8, 152.0], [82.9, 152.0], [83.0, 152.0], [83.1, 153.0], [83.2, 154.0], [83.3, 154.0], [83.4, 155.0], [83.5, 155.0], [83.6, 156.0], [83.7, 156.0], [83.8, 157.0], [83.9, 157.0], [84.0, 158.0], [84.1, 159.0], [84.2, 159.0], [84.3, 160.0], [84.4, 160.0], [84.5, 161.0], [84.6, 161.0], [84.7, 162.0], [84.8, 162.0], [84.9, 163.0], [85.0, 164.0], [85.1, 164.0], [85.2, 165.0], [85.3, 165.0], [85.4, 166.0], [85.5, 167.0], [85.6, 167.0], [85.7, 168.0], [85.8, 169.0], [85.9, 169.0], [86.0, 170.0], [86.1, 171.0], [86.2, 172.0], [86.3, 172.0], [86.4, 173.0], [86.5, 173.0], [86.6, 174.0], [86.7, 175.0], [86.8, 176.0], [86.9, 176.0], [87.0, 177.0], [87.1, 178.0], [87.2, 178.0], [87.3, 179.0], [87.4, 180.0], [87.5, 180.0], [87.6, 181.0], [87.7, 181.0], [87.8, 182.0], [87.9, 183.0], [88.0, 183.0], [88.1, 184.0], [88.2, 185.0], [88.3, 186.0], [88.4, 187.0], [88.5, 187.0], [88.6, 188.0], [88.7, 189.0], [88.8, 190.0], [88.9, 191.0], [89.0, 192.0], [89.1, 193.0], [89.2, 194.0], [89.3, 195.0], [89.4, 196.0], [89.5, 197.0], [89.6, 198.0], [89.7, 199.0], [89.8, 200.0], [89.9, 201.0], [90.0, 202.0], [90.1, 203.0], [90.2, 204.0], [90.3, 205.0], [90.4, 206.0], [90.5, 207.0], [90.6, 208.0], [90.7, 209.0], [90.8, 211.0], [90.9, 212.0], [91.0, 214.0], [91.1, 215.0], [91.2, 217.0], [91.3, 218.0], [91.4, 219.0], [91.5, 221.0], [91.6, 222.0], [91.7, 224.0], [91.8, 225.0], [91.9, 226.0], [92.0, 228.0], [92.1, 229.0], [92.2, 231.0], [92.3, 232.0], [92.4, 234.0], [92.5, 236.0], [92.6, 238.0], [92.7, 240.0], [92.8, 241.0], [92.9, 243.0], [93.0, 245.0], [93.1, 247.0], [93.2, 249.0], [93.3, 251.0], [93.4, 253.0], [93.5, 255.0], [93.6, 257.0], [93.7, 260.0], [93.8, 262.0], [93.9, 265.0], [94.0, 268.0], [94.1, 270.0], [94.2, 274.0], [94.3, 277.0], [94.4, 280.0], [94.5, 283.0], [94.6, 285.0], [94.7, 289.0], [94.8, 292.0], [94.9, 295.0], [95.0, 298.0], [95.1, 301.0], [95.2, 304.0], [95.3, 307.0], [95.4, 311.0], [95.5, 315.0], [95.6, 319.0], [95.7, 324.0], [95.8, 328.0], [95.9, 333.0], [96.0, 338.0], [96.1, 343.0], [96.2, 346.0], [96.3, 351.0], [96.4, 356.0], [96.5, 361.0], [96.6, 368.0], [96.7, 374.0], [96.8, 379.0], [96.9, 386.0], [97.0, 396.0], [97.1, 403.0], [97.2, 410.0], [97.3, 420.0], [97.4, 431.0], [97.5, 440.0], [97.6, 449.0], [97.7, 457.0], [97.8, 466.0], [97.9, 480.0], [98.0, 493.0], [98.1, 505.0], [98.2, 522.0], [98.3, 536.0], [98.4, 553.0], [98.5, 566.0], [98.6, 582.0], [98.7, 600.0], [98.8, 626.0], [98.9, 651.0], [99.0, 670.0], [99.1, 695.0], [99.2, 708.0], [99.3, 742.0], [99.4, 768.0], [99.5, 810.0], [99.6, 879.0], [99.7, 932.0], [99.8, 993.0], [99.9, 1074.0]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 100.0, "title": "Response Time Percentiles"}},
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
        data: {"result": {"minY": 8.0, "minX": 0.0, "maxY": 622723.0, "series": [{"data": [[0.0, 622723.0], [1500.0, 8.0], [500.0, 11190.0], [1000.0, 1204.0]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 500, "maxX": 1500.0, "title": "Response Time Distribution"}},
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
        data: {"result": {"minY": 455.0, "minX": 0.0, "ticks": [[0, "Requests having \nresponse time <= 500ms"], [1, "Requests having \nresponse time > 500ms and <= 1,500ms"], [2, "Requests having \nresponse time > 1,500ms"], [3, "Requests in error"]], "maxY": 622345.0, "series": [{"data": [[1.0, 12325.0]], "isOverall": false, "label": "Requests having \nresponse time > 500ms and <= 1,500ms", "isController": false}, {"data": [[3.0, 455.0]], "isOverall": false, "label": "Requests in error", "isController": false}, {"data": [[0.0, 622345.0]], "isOverall": false, "label": "Requests having \nresponse time <= 500ms", "isController": false}], "supportsControllersDiscrimination": false, "maxX": 3.0, "title": "Synthetic Response Times Distribution"}},
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
        data: {"result": {"minY": 536.1690096297518, "minX": 1.50499098E12, "maxY": 951.8719309887197, "series": [{"data": [[1.50499104E12, 718.4139922728667], [1.5049911E12, 536.1690096297518], [1.50499098E12, 951.8719309887197]], "isOverall": false, "label": "Thread Group", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.5049911E12, "title": "Active Threads Over Time"}},
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
        data: {"result": {"minY": 1.0, "minX": 2.0, "maxY": 1215.0, "series": [{"data": [[2.0, 1.0], [4.0, 1.0], [5.0, 2.0], [6.0, 7.5], [8.0, 8.428571428571429], [10.0, 1.0], [11.0, 4.833333333333333], [13.0, 5.0], [14.0, 1.0], [16.0, 1.1666666666666665], [17.0, 1.6666666666666667], [18.0, 2.0], [20.0, 1.3333333333333333], [21.0, 1.5], [23.0, 3.0], [24.0, 2.25], [25.0, 4.333333333333333], [26.0, 1.0], [27.0, 2.0], [28.0, 1.25], [29.0, 1.5], [30.0, 5.133333333333334], [31.0, 6.0], [33.0, 5.5], [35.0, 6.0], [34.0, 6.0], [37.0, 4.333333333333333], [36.0, 5.23076923076923], [39.0, 4.75], [38.0, 12.857142857142856], [41.0, 3.6666666666666665], [40.0, 4.666666666666667], [43.0, 3.25], [42.0, 8.444444444444445], [45.0, 8.047619047619047], [44.0, 5.166666666666666], [47.0, 4.8], [46.0, 11.733333333333334], [49.0, 5.333333333333333], [48.0, 5.0], [51.0, 15.818181818181817], [50.0, 5.000000000000001], [53.0, 5.5], [52.0, 5.6], [55.0, 5.1], [54.0, 5.5], [57.0, 5.0], [56.0, 5.25], [59.0, 7.166666666666667], [58.0, 5.2727272727272725], [61.0, 7.3], [63.0, 7.4], [62.0, 7.0], [66.0, 11.4], [65.0, 9.25], [64.0, 8.25], [71.0, 10.0], [70.0, 9.5], [69.0, 11.277777777777777], [68.0, 12.25925925925926], [74.0, 7.5], [73.0, 10.11111111111111], [72.0, 10.666666666666666], [78.0, 6.666666666666667], [77.0, 9.000000000000002], [76.0, 8.833333333333334], [83.0, 9.26829268292683], [82.0, 7.0], [81.0, 7.923076923076923], [80.0, 8.0], [87.0, 10.2], [85.0, 10.400000000000002], [84.0, 10.333333333333334], [91.0, 14.5], [90.0, 14.25], [89.0, 12.833333333333334], [88.0, 10.90909090909091], [95.0, 16.52173913043478], [94.0, 16.5], [93.0, 15.428571428571429], [92.0, 15.666666666666666], [99.0, 15.71875], [97.0, 16.583333333333332], [103.0, 15.25], [102.0, 15.166666666666666], [100.0, 15.416666666666666], [107.0, 17.866666666666667], [105.0, 16.2], [104.0, 15.421052631578949], [111.0, 16.272727272727273], [110.0, 16.6], [108.0, 17.0], [115.0, 29.5], [114.0, 21.200000000000003], [113.0, 18.666666666666664], [112.0, 17.375], [119.0, 19.909090909090907], [118.0, 19.846153846153847], [116.0, 37.5], [123.0, 18.571428571428573], [122.0, 19.285714285714285], [121.0, 20.0], [120.0, 20.0], [127.0, 15.0], [126.0, 17.0], [125.0, 18.375], [124.0, 18.4], [135.0, 9.0], [134.0, 11.153846153846153], [133.0, 11.5], [132.0, 12.0], [131.0, 13.37037037037037], [130.0, 15.5], [128.0, 14.21875], [143.0, 11.0], [142.0, 9.20588235294118], [141.0, 8.19047619047619], [140.0, 10.642857142857142], [139.0, 9.661016949152541], [137.0, 13.58536585365854], [136.0, 9.5], [151.0, 17.333333333333336], [150.0, 18.25], [148.0, 21.428571428571427], [147.0, 23.666666666666668], [146.0, 15.666666666666666], [145.0, 12.571428571428571], [144.0, 9.73684210526316], [159.0, 12.000000000000002], [158.0, 11.0], [157.0, 17.5], [156.0, 14.285714285714285], [155.0, 14.8], [154.0, 17.0], [153.0, 14.222222222222221], [152.0, 14.285714285714286], [167.0, 8.277777777777777], [166.0, 10.444444444444443], [164.0, 13.5], [163.0, 12.0], [162.0, 14.555555555555554], [160.0, 13.833333333333334], [175.0, 5.0], [171.0, 2.0], [170.0, 6.5], [169.0, 7.0], [176.0, 4.666666666666667], [194.0, 3.220779220779222], [207.0, 18.000000000000004], [206.0, 17.0], [205.0, 17.25], [204.0, 18.95454545454545], [203.0, 19.0], [202.0, 19.0], [201.0, 15.69333333333333], [215.0, 22.25], [214.0, 21.636363636363637], [213.0, 18.0], [212.0, 16.25], [211.0, 16.454545454545457], [210.0, 18.240000000000002], [209.0, 15.090909090909092], [208.0, 15.73913043478261], [223.0, 83.83333333333333], [222.0, 59.93749999999999], [221.0, 132.88888888888889], [220.0, 33.90322580645161], [219.0, 154.8], [218.0, 125.0], [217.0, 150.5], [216.0, 114.78947368421055], [231.0, 22.560000000000002], [230.0, 17.8], [229.0, 15.2], [228.0, 15.0], [227.0, 14.714285714285715], [226.0, 49.285714285714285], [225.0, 80.5], [224.0, 78.00000000000001], [238.0, 28.857142857142858], [237.0, 27.916666666666664], [236.0, 26.0], [235.0, 24.5], [234.0, 24.583333333333332], [233.0, 22.25], [247.0, 28.428571428571427], [246.0, 29.0], [245.0, 30.0], [244.0, 30.25], [243.0, 31.142857142857146], [242.0, 42.3], [241.0, 30.266666666666666], [240.0, 34.92307692307691], [255.0, 18.5], [254.0, 21.642857142857142], [253.0, 24.0], [252.0, 25.0], [251.0, 24.72727272727273], [250.0, 25.0], [249.0, 28.000000000000004], [248.0, 28.72727272727273], [270.0, 24.636363636363637], [271.0, 24.5], [269.0, 23.333333333333336], [268.0, 21.909090909090907], [267.0, 20.370370370370374], [265.0, 21.1], [264.0, 20.481481481481477], [263.0, 19.5], [256.0, 17.5], [258.0, 19.727272727272727], [257.0, 19.12903225806452], [262.0, 19.849999999999998], [261.0, 19.375], [260.0, 19.5625], [286.0, 31.214285714285715], [287.0, 36.6875], [285.0, 31.33333333333334], [284.0, 28.0], [283.0, 27.25], [281.0, 25.75], [280.0, 56.77272727272728], [279.0, 60.5], [273.0, 25.416666666666668], [272.0, 25.72727272727273], [275.0, 26.625], [274.0, 26.482758620689655], [277.0, 36.24999999999999], [276.0, 27.69047619047619], [302.0, 49.75], [303.0, 50.0], [301.0, 45.142857142857146], [300.0, 41.166666666666664], [299.0, 42.416666666666664], [298.0, 48.63999999999999], [296.0, 49.0], [295.0, 50.625], [289.0, 46.5625], [288.0, 41.0], [291.0, 48.83333333333333], [290.0, 47.0], [293.0, 53.31818181818183], [292.0, 47.6], [318.0, 37.24489795918367], [319.0, 38.61538461538462], [317.0, 35.5], [316.0, 34.95454545454546], [315.0, 35.0], [314.0, 33.30303030303029], [313.0, 37.05882352941177], [312.0, 35.27777777777778], [311.0, 36.6], [305.0, 50.5], [307.0, 49.878787878787875], [306.0, 49.375], [310.0, 38.5], [309.0, 45.137931034482754], [308.0, 49.81818181818181], [334.0, 52.333333333333336], [335.0, 55.625], [333.0, 45.38636363636365], [332.0, 42.57142857142858], [331.0, 42.65217391304348], [329.0, 43.300000000000004], [328.0, 43.261904761904766], [327.0, 42.43750000000001], [321.0, 39.916666666666664], [320.0, 39.0], [323.0, 41.08333333333333], [322.0, 40.54545454545455], [326.0, 41.199999999999996], [325.0, 40.666666666666664], [350.0, 125.52631578947368], [351.0, 145.25], [349.0, 73.375], [339.0, 56.0], [338.0, 56.2], [337.0, 62.61538461538462], [336.0, 78.6], [347.0, 107.4], [346.0, 62.062499999999986], [345.0, 53.10526315789474], [344.0, 81.09090909090908], [343.0, 83.26315789473684], [342.0, 179.66666666666666], [341.0, 95.875], [340.0, 56.333333333333336], [355.0, 38.95], [367.0, 186.83720930232553], [364.0, 135.0], [354.0, 98.0], [353.0, 100.16666666666666], [352.0, 106.29268292682927], [363.0, 375.0], [361.0, 110.0], [360.0, 89.75], [359.0, 96.33333333333333], [358.0, 69.0], [357.0, 97.0], [356.0, 62.25000000000001], [382.0, 38.78787878787879], [383.0, 44.61904761904761], [381.0, 30.999999999999996], [380.0, 29.264705882352946], [379.0, 24.999999999999996], [378.0, 29.220588235294112], [377.0, 23.0], [376.0, 129.45], [375.0, 152.73333333333335], [369.0, 191.0909090909091], [368.0, 183.92857142857147], [371.0, 150.57142857142856], [370.0, 158.27272727272728], [374.0, 136.6], [373.0, 133.66666666666666], [372.0, 136.0], [398.0, 60.0], [396.0, 241.43103448275863], [399.0, 66.51612903225806], [397.0, 69.46428571428572], [395.0, 52.91780821917809], [394.0, 54.0], [393.0, 52.07142857142858], [392.0, 51.75], [391.0, 52.21875], [385.0, 49.95454545454545], [384.0, 49.24999999999999], [387.0, 49.85714285714286], [386.0, 50.5952380952381], [390.0, 51.2], [389.0, 50.83333333333333], [388.0, 51.2], [402.0, 100.76190476190479], [403.0, 92.07692307692307], [412.0, 139.76666666666665], [413.0, 202.625], [414.0, 134.41666666666666], [415.0, 90.33333333333333], [405.0, 219.35985533453896], [401.0, 52.27586206896552], [400.0, 74.2432432432432], [404.0, 59.56000000000002], [406.0, 69.43478260869568], [407.0, 65.9], [408.0, 136.2], [409.0, 150.21428571428575], [410.0, 142.37142857142857], [411.0, 119.85714285714286], [430.0, 83.83333333333333], [417.0, 121.57142857142858], [416.0, 78.78571428571429], [423.0, 51.0], [422.0, 51.54545454545455], [421.0, 54.10112359550561], [420.0, 56.5], [418.0, 64.68000000000002], [419.0, 61.666666666666664], [431.0, 71.80733944954129], [425.0, 49.84615384615385], [424.0, 50.285714285714285], [429.0, 82.42424242424242], [428.0, 74.17307692307692], [427.0, 49.57142857142857], [426.0, 48.599999999999994], [446.0, 74.83333333333333], [432.0, 139.45454545454547], [435.0, 162.063492063492], [434.0, 57.30769230769231], [433.0, 59.75], [436.0, 44.04347826086957], [437.0, 35.96428571428571], [439.0, 32.120000000000005], [438.0, 36.28571428571429], [447.0, 67.54838709677419], [441.0, 37.69999999999999], [440.0, 22.25641025641026], [445.0, 81.79310344827586], [444.0, 92.92], [443.0, 113.8111111111111], [442.0, 135.5], [460.0, 79.33333333333333], [451.0, 431.17529880478077], [455.0, 73.0], [449.0, 53.98275862068964], [448.0, 61.22222222222223], [450.0, 46.800000000000004], [453.0, 63.98130841121495], [452.0, 42.142857142857146], [454.0, 77.18518518518519], [456.0, 86.66666666666666], [457.0, 96.89473684210526], [459.0, 75.0], [458.0, 74.05555555555554], [462.0, 83.15625], [463.0, 93.71794871794874], [461.0, 80.325], [477.0, 83.79310344827586], [465.0, 110.00000000000001], [467.0, 89.25], [466.0, 78.0], [476.0, 73.76923076923079], [469.0, 159.83333333333331], [468.0, 80.58064516129035], [471.0, 105.75], [464.0, 77.85714285714285], [470.0, 82.0], [472.0, 84.42499999999998], [474.0, 86.51351351351349], [473.0, 76.48809523809523], [475.0, 93.67999999999999], [479.0, 72.2], [478.0, 71.4090909090909], [493.0, 81.3186813186813], [483.0, 89.68571428571428], [486.0, 68.99999999999999], [482.0, 70.125], [480.0, 72.25], [484.0, 73.76363636363638], [485.0, 71.14285714285712], [490.0, 103.71875000000001], [491.0, 79.32191780821914], [494.0, 87.26666666666667], [495.0, 88.04081632653062], [489.0, 75.00000000000001], [488.0, 74.00000000000001], [492.0, 76.28571428571429], [508.0, 72.09459459459457], [496.0, 88.39999999999999], [497.0, 78.4251968503937], [499.0, 82.00000000000001], [498.0, 64.88888888888889], [503.0, 70.68000000000004], [502.0, 58.5], [501.0, 61.526315789473685], [500.0, 71.57142857142857], [506.0, 71.64285714285714], [507.0, 139.0], [509.0, 130.9090909090909], [511.0, 78.36363636363637], [505.0, 67.75], [504.0, 67.09868421052634], [510.0, 74.48000000000002], [539.0, 123.89915966386559], [526.0, 63.91739130434782], [523.0, 85.95867768595042], [522.0, 83.09876543209876], [521.0, 93.68181818181817], [520.0, 78.35616438356162], [524.0, 79.84023668639048], [525.0, 122.71428571428574], [529.0, 50.58389261744967], [528.0, 44.6964285714286], [542.0, 33.74791318864776], [543.0, 9.571428571428573], [540.0, 26.034343434343437], [541.0, 105.28965517241375], [538.0, 247.12499999999994], [536.0, 107.03597122302172], [527.0, 47.473684210526315], [512.0, 73.42857142857143], [514.0, 72.33333333333331], [513.0, 73.16666666666667], [516.0, 73.3], [515.0, 72.0], [518.0, 70.8], [517.0, 72.27586206896552], [519.0, 75.12056737588652], [537.0, 150.2187499999999], [530.0, 284.18404907975446], [531.0, 59.84232954545451], [532.0, 74.53191489361704], [533.0, 59.08695652173912], [534.0, 45.39487179487179], [535.0, 66.89215686274508], [551.0, 282.0], [547.0, 207.0], [544.0, 18.05454545454544], [558.0, 257.14285714285717], [559.0, 286.0], [555.0, 281.0], [557.0, 282.6666666666667], [545.0, 26.74762243147069], [546.0, 277.8], [548.0, 291.5], [549.0, 281.0], [550.0, 277.1428571428571], [560.0, 293.0], [574.0, 310.3684210526316], [575.0, 186.0], [572.0, 302.2857142857143], [573.0, 272.0], [570.0, 226.83333333333334], [571.0, 292.8333333333333], [568.0, 309.0], [569.0, 83.81021897810218], [561.0, 215.55555555555554], [562.0, 214.33333333333334], [563.0, 304.49999999999994], [564.0, 313.0], [565.0, 318.0666666666667], [566.0, 246.25], [567.0, 308.2857142857143], [552.0, 668.0], [554.0, 305.375], [581.0, 233.66666666666669], [577.0, 276.22222222222223], [576.0, 307.4166666666667], [591.0, 682.5], [578.0, 318.8], [579.0, 259.69230769230774], [580.0, 342.2857142857143], [592.0, 679.0], [606.0, 557.3333333333334], [607.0, 686.0], [602.0, 683.5], [605.0, 685.0], [600.0, 682.0], [583.0, 321.0], [582.0, 190.0], [601.0, 686.5], [593.0, 680.0], [594.0, 681.5], [595.0, 681.6666666666666], [596.0, 681.5], [597.0, 682.5], [598.0, 683.5], [599.0, 682.5], [586.0, 404.8707865168538], [585.0, 216.6], [587.0, 528.0], [588.0, 306.0], [589.0, 51.5], [590.0, 678.5], [611.0, 681.5], [608.0, 684.0], [623.0, 685.3333333333334], [620.0, 689.0], [621.0, 691.6666666666666], [618.0, 698.6666666666666], [619.0, 780.0], [609.0, 683.5], [610.0, 753.25], [612.0, 686.3333333333334], [613.0, 686.0], [614.0, 681.0], [615.0, 681.0], [624.0, 684.0], [639.0, 652.0], [637.0, 649.0], [638.0, 654.0], [634.0, 667.3333333333334], [635.0, 656.5], [632.0, 782.6666666666666], [633.0, 668.3333333333334], [625.0, 692.75], [626.0, 678.0], [627.0, 680.6666666666666], [628.0, 671.3333333333334], [629.0, 672.5], [630.0, 669.3333333333334], [631.0, 576.5], [616.0, 679.6], [617.0, 687.5], [646.0, 52.186136071886956], [642.0, 497.0], [640.0, 668.0], [644.0, 508.0], [643.0, 13.629629629629628], [645.0, 52.0], [647.0, 509.0], [664.0, 118.47826086956522], [666.0, 61.14869888475837], [665.0, 87.53731343283583], [668.0, 55.0], [667.0, 57.333333333333336], [669.0, 130.71428571428572], [671.0, 56.8], [654.0, 628.0], [655.0, 509.0], [658.0, 603.0], [660.0, 694.0], [662.0, 215.5], [663.0, 78.0], [700.0, 349.0], [675.0, 149.375], [672.0, 87.3], [687.0, 52.75], [686.0, 54.166666666666664], [684.0, 54.0], [683.0, 55.666666666666664], [682.0, 58.142857142857146], [681.0, 60.6], [680.0, 55.44444444444444], [673.0, 167.4019607843137], [674.0, 243.33333333333331], [677.0, 111.76923076923076], [679.0, 58.66666666666667], [678.0, 57.0], [697.0, 43.0], [696.0, 42.0], [699.0, 141.75000000000003], [698.0, 318.3865030674849], [689.0, 312.5], [691.0, 239.0], [690.0, 41.0], [693.0, 43.0], [692.0, 42.0], [695.0, 43.0], [694.0, 43.0], [703.0, 238.29752066115702], [688.0, 46.333333333333336], [702.0, 107.89158716392016], [701.0, 47.0], [711.0, 665.3333333333333], [707.0, 536.4150943396226], [704.0, 475.0838150289017], [716.0, 373.5], [717.0, 98.0], [719.0, 390.2], [706.0, 693.8405405405405], [705.0, 380.125], [708.0, 714.0], [709.0, 385.6666666666667], [710.0, 90.80761856065455], [720.0, 374.0], [735.0, 293.0769230769231], [733.0, 448.83333333333337], [732.0, 72.0], [734.0, 284.0], [730.0, 376.0], [731.0, 445.0], [728.0, 375.99999999999994], [729.0, 613.6666666666666], [721.0, 591.6666666666666], [722.0, 373.0], [723.0, 390.25], [724.0, 376.5], [725.0, 378.5], [727.0, 553.5], [712.0, 238.8], [714.0, 1215.0], [715.0, 295.6666666666667], [743.0, 305.5], [739.0, 410.6666666666667], [737.0, 558.0], [751.0, 23.0], [740.0, 525.5], [741.0, 197.74999999999997], [742.0, 162.0], [766.0, 73.0], [752.0, 166.5714285714286], [754.0, 87.16666666666666], [753.0, 84.12000000000002], [756.0, 82.24561403508763], [755.0, 73.09523809523809], [759.0, 73.5], [757.0, 67.0], [765.0, 73.0], [764.0, 73.0], [762.0, 567.5], [760.0, 78.66666666666667], [744.0, 64.5], [745.0, 276.6], [746.0, 126.75], [747.0, 1065.0], [748.0, 150.39999999999998], [797.0, 378.0], [794.0, 330.8542435424354], [795.0, 326.33333333333337], [796.0, 201.66666666666669], [798.0, 267.5], [799.0, 441.0], [793.0, 65.0], [783.0, 66.5], [769.0, 72.0], [768.0, 72.0], [771.0, 85.0], [770.0, 71.0], [773.0, 70.0], [772.0, 70.0], [775.0, 69.0], [774.0, 68.0], [782.0, 67.0], [780.0, 68.0], [779.0, 67.0], [778.0, 67.0], [777.0, 68.0], [791.0, 65.0], [790.0, 64.0], [789.0, 64.0], [788.0, 64.0], [787.0, 65.0], [786.0, 65.0], [785.0, 65.0], [784.0, 66.0], [813.0, 724.0], [800.0, 252.33333333333331], [802.0, 1087.0], [801.0, 61.0], [803.0, 891.0], [804.0, 230.0], [805.0, 484.7500000000001], [816.0, 453.65277777777777], [807.0, 60.5], [806.0, 61.0], [817.0, 378.5023474178402], [808.0, 349.5], [810.0, 41.785714285714285], [809.0, 185.48822668617794], [811.0, 725.0], [812.0, 717.0], [814.0, 722.0], [815.0, 439.15789473684214], [862.0, 82.75], [863.0, 83.0], [853.0, 76.45622119815671], [861.0, 80.28571428571429], [860.0, 84.33333333333333], [859.0, 82.5], [858.0, 79.55555555555556], [856.0, 80.25], [855.0, 80.42857142857143], [854.0, 77.0], [889.0, 197.83531691115402], [881.0, 77.33333333333333], [894.0, 10.0], [895.0, 7.0], [880.0, 69.19999999999999], [890.0, 52.0], [888.0, 78.0], [870.0, 83.66666666666667], [869.0, 84.0], [868.0, 87.0], [866.0, 84.0], [865.0, 84.0], [864.0, 79.42857142857142], [878.0, 76.4], [876.0, 77.5], [875.0, 84.0], [874.0, 84.0], [872.0, 85.5], [886.0, 77.33333333333333], [884.0, 78.0], [882.0, 70.2], [924.0, 16.0], [920.0, 23.222222222222218], [903.0, 9.0], [902.0, 9.0], [901.0, 9.0], [899.0, 9.0], [898.0, 10.0], [897.0, 10.5], [917.0, 242.88859307802582], [915.0, 7.0], [914.0, 7.0], [913.0, 8.0], [912.0, 7.666666666666667], [909.0, 8.5], [908.0, 8.0], [906.0, 7.5], [905.0, 9.666666666666666], [948.0, 80.01111111111113], [955.0, 227.56263498920106], [945.0, 83.72151898734174], [944.0, 82.0], [954.0, 111.94970986460349], [953.0, 223.0], [933.0, 2.8764478764478763], [943.0, 1.4], [942.0, 82.83333333333334], [939.0, 247.0], [951.0, 231.5], [950.0, 2.0], [949.0, 88.6], [947.0, 92.41025641025641], [946.0, 72.45833333333333], [991.0, 180.9419417354334], [990.0, 60.333333333333336], [989.0, 62.75], [988.0, 63.45454545454545], [987.0, 66.0], [986.0, 63.93548387096774], [983.0, 67.5172413793103]], "isOverall": false, "label": "HTTP Request", "isController": false}, {"data": [[675.5087880338414, 78.49528360558978]], "isOverall": false, "label": "HTTP Request-Aggregated", "isController": false}], "supportsControllersDiscrimination": true, "maxX": 991.0, "title": "Time VS Threads"}},
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
        data : {"result": {"minY": 99583.16666666667, "minX": 1.50499098E12, "maxY": 949294.2833333333, "series": [{"data": [[1.50499104E12, 949294.2833333333], [1.5049911E12, 496646.75], [1.50499098E12, 105900.13333333333]], "isOverall": false, "label": "Bytes received per second", "isController": false}, {"data": [[1.50499104E12, 885635.9833333333], [1.5049911E12, 472670.7], [1.50499098E12, 99583.16666666667]], "isOverall": false, "label": "Bytes sent per second", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.5049911E12, "title": "Bytes Throughput Over Time"}},
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
        data: {"result": {"minY": 30.902228126262465, "minX": 1.50499098E12, "maxY": 271.46308033773425, "series": [{"data": [[1.50499104E12, 81.98707998953206], [1.5049911E12, 30.902228126262465], [1.50499098E12, 271.46308033773425]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.5049911E12, "title": "Response Time Over Time"}},
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
        data: {"result": {"minY": 30.90021848191587, "minX": 1.50499098E12, "maxY": 271.42212205111974, "series": [{"data": [[1.50499104E12, 81.82917393298563], [1.5049911E12, 30.90021848191587], [1.50499098E12, 271.42212205111974]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.5049911E12, "title": "Latencies Over Time"}},
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
        data: {"result": {"minY": 0.3938805599754753, "minX": 1.50499098E12, "maxY": 6.521497380042474, "series": [{"data": [[1.50499104E12, 0.854158838909295], [1.5049911E12, 0.3938805599754753], [1.50499098E12, 6.521497380042474]], "isOverall": false, "label": "HTTP Request", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.5049911E12, "title": "Connect Time Over Time"}},
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
        data: {"result": {"minY": 0.0, "minX": 1.50499098E12, "maxY": 1414.0, "series": [{"data": [[1.50499104E12, 1414.0], [1.5049911E12, 623.0], [1.50499098E12, 1404.0]], "isOverall": false, "label": "Max", "isController": false}, {"data": [[1.50499104E12, 0.0], [1.5049911E12, 0.0], [1.50499098E12, 0.0]], "isOverall": false, "label": "Min", "isController": false}, {"data": [[1.50499104E12, 44.0], [1.5049911E12, 80.0], [1.50499098E12, 336.0]], "isOverall": false, "label": "90th percentile", "isController": false}, {"data": [[1.50499104E12, 191.0], [1.5049911E12, 185.0], [1.50499098E12, 633.9900000000016]], "isOverall": false, "label": "99th percentile", "isController": false}, {"data": [[1.50499104E12, 78.0], [1.5049911E12, 136.0], [1.50499098E12, 394.0]], "isOverall": false, "label": "95th percentile", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.5049911E12, "title": "Response Time Percentiles Over Time (successful requests only)"}},
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
    data: {"result": {"minY": 7.0, "minX": 425.0, "maxY": 179.0, "series": [{"data": [[728.0, 179.0], [431.0, 7.0], [425.0, 39.0]], "isOverall": false, "label": "Successes", "isController": false}, {"data": [[728.0, 109.0], [431.0, 63.0]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 728.0, "title": "Response Time Vs Request"}},
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
    data: {"result": {"minY": 0.0, "minX": 425.0, "maxY": 179.0, "series": [{"data": [[728.0, 179.0], [431.0, 7.0], [425.0, 39.0]], "isOverall": false, "label": "Successes", "isController": false}, {"data": [[728.0, 0.0], [431.0, 0.0]], "isOverall": false, "label": "Failures", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 728.0, "title": "Latencies Vs Request"}},
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
        data: {"result": {"minY": 728.3833333333333, "minX": 1.50499098E12, "maxY": 6431.883333333333, "series": [{"data": [[1.50499104E12, 6431.883333333333], [1.5049911E12, 3425.15], [1.50499098E12, 728.3833333333333]], "isOverall": false, "label": "hitsPerSecond", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.5049911E12, "title": "Hits Per Second"}},
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
        data: {"result": {"minY": 0.15, "minX": 1.50499098E12, "maxY": 6424.45, "series": [{"data": [[1.50499104E12, 6424.45], [1.5049911E12, 3425.15], [1.50499098E12, 728.2333333333333]], "isOverall": false, "label": "200", "isController": false}, {"data": [[1.50499104E12, 7.433333333333334], [1.50499098E12, 0.15]], "isOverall": false, "label": "Non HTTP response code: java.net.SocketException", "isController": false}], "supportsControllersDiscrimination": false, "granularity": 60000, "maxX": 1.5049911E12, "title": "Codes Per Second"}},
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
        data: {"result": {"minY": 0.15, "minX": 1.50499098E12, "maxY": 6424.45, "series": [{"data": [[1.50499104E12, 6424.45], [1.5049911E12, 3425.15], [1.50499098E12, 728.2333333333333]], "isOverall": false, "label": "HTTP Request-success", "isController": false}, {"data": [[1.50499104E12, 7.433333333333334], [1.50499098E12, 0.15]], "isOverall": false, "label": "HTTP Request-failure", "isController": false}], "supportsControllersDiscrimination": true, "granularity": 60000, "maxX": 1.5049911E12, "title": "Transactions Per Second"}},
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
