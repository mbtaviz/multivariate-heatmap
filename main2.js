
var rowHeight = 15;
var gutter = 0;
var minArmLength = 0.5;
var maxArmLength = 7;
var minStrokeWidth = 0.5;
var maxStrokeWidth = 2.5;
var stopWidth = 15;

var gridMargin = {top: 20, left: 50, bottom: 0, right: 0};
var lineFunc = d3.svg.line()
  .x(function (d) { return d[0]; })
  .y(function (d) { return d[1]; })
  .interpolate('linear');

// progress indicator for our large data file
var text = d3.select('.progress')
  .append('p');
var progress = 0;
var total = 4668028;

d3.json('dataPerStop.json')
  .on('progress', function() {
      var i = d3.interpolate(progress, d3.event.loaded / total);
      d3.transition().tween("progress", function() {
        return function(t) {
          progress = i(t);
          text.text('loading data '+d3.format(".0%")(progress));
        };
      });
  })
  .get(function(error, data) {
    d3.json('medians.json', function (medians) {
      d3.json('metrics.json', function (metrics) {
        d3.json('stopNodesAndLinks.json', function (keyData) {
          data.forEach(function (d) {
            d.lines.forEach(function (line) {
              var stopsById = _.indexBy(line.stops, 'key');
              line.stops.forEach(function (stop, i) {
                if (stop.before && stopsById[stop.before.key]) {
                  stop.before.name = stopsById[stop.before.key].name;
                  stop.before.ins = stopsById[stop.before.key].ins;
                  stop.before.outs = stopsById[stop.before.key].outs;
                }
              });
            });
          });
    
          var svg = d3.select('.graphic').append('svg')
            .attr('height', function (d) { return times(data).length * rowHeight; })
            .attr('width', function() { return stopWidth * 22; });
          var redLineStops = stopLabels(keyData, "red");
          var redkeyToIndex = stopIndex(redLineStops);
          var redLineKeysToStops = stopKeyToLabel(keyData, "red");
      

          // -----------------------------------------------
          // Scales and Axis
          // -----------------------------------------------
          var xScale = d3.scale.ordinal()
            .domain(redLineStops)
            .range([0, redLineStops.length * stopWidth]);
          var yScale = d3.time.scale()
            .domain([d3.min(times(data)), d3.max(times(data))])
            .rangeRound([0, times(data).length * rowHeight]);

          var hourAxis = d3.svg.axis()
            .tickFormat(d3.time.format("%-I:%M %p"))
            .ticks(d3.time.hour, 1)
            .scale(yScale)
            .orient("left");
          svg.append('g')
            .attr('class', 'y axis')
            .attr('transform', function () {return 'translate('+(gridMargin.left-1)+', '+gridMargin.top+')'; })
            .call(hourAxis);
          var dayAxis = d3.svg.axis()
            .tickFormat(d3.time.format("%a %-m/%-d"))
            .ticks(d3.time.day, 1)
            .scale(yScale)
            .orient("left");
          svg.append('g')
            .attr('class', 'day axis')
            .attr('transform', function () {return 'translate('+(gridMargin.left-1)+', '+(gridMargin.top-13)+')'; })
            .call(dayAxis);

      
          // -----------------------------------------------
          // Grid
          // -----------------------------------------------
          // color scales for values
          var insColorScale = d3.scale.linear()
            .domain([100, metrics.turnstile.max])
            .range(['black', 'red'])
            .clamp(true);
          var inWidthScale = d3.scale.linear()
            .domain([100, metrics.turnstile.max])
            .range([minStrokeWidth, maxStrokeWidth])
            .clamp(true);
          var insLengthScale = d3.scale.linear()
            .domain([0, 100])
            .range([minArmLength, maxArmLength])
            .clamp(true);
          var outsColorScale = d3.scale.linear()
            .domain([100, metrics.turnstile.max])
            .range(['black', 'red'])
            .clamp(true);
          var outWidthScale = d3.scale.linear()
            .domain([100, metrics.turnstile.max])
            .range([minStrokeWidth, maxStrokeWidth])
            .clamp(true);
          var outsLengthScale = d3.scale.linear()
            .domain([0, 100])
            .range([0, maxArmLength])
            .clamp(true);
    
          // our delay scale is measured in 'medians'.  If
          // the time from station to station is less than or
          // equal to the median value it's in the 0-1 range.
          // 1-2 is median to twice the median, 2-3 is
          // two to three times the median
          var delayColorScale = d3.scale.linear()
            .domain([0, 1, 2, 3])
            .range(['white', '#f0f0f0','black', 'red'])
            .clamp(true);
          var delayWidthScale = d3.scale.linear()
            .domain([2, 3])
            .range([minStrokeWidth, maxStrokeWidth])
            .clamp(true);
          var delayLengthScale = d3.scale.linear()
            .domain([0, 2])
            .range([minArmLength, maxArmLength])
            .clamp(true);
      
          var grid = svg.append('g')
            .attr('transform', function (d) { return 'translate('+gridMargin.left+', '+gridMargin.top+')'; });
          
          var row = grid.selectAll('.row')
            .data(data).enter()
              .append('g')
              .attr('class', 'row')
              .attr('transform', function (d) { return 'translate(0,'+yScale(d.time)+')'; })
            .selectAll('.entry')
              .data(function (d) {return stopsInLine(d, "red"); })
            .enter()
              .append('g')
              .attr('transform', function (d) {
                var index = redkeyToIndex[d.key];
                var xLocation = index * stopWidth;
                return 'translate(' + (xLocation) + ',' + (rowHeight/2) + ')';
              });

          // exits
          row.append('line')
            .attr('class', 'exits')
            .attr('y1', function (d) {
              return -(insLengthScale(d.ins || 0) + outsLengthScale(d.outs || 0));
            })
            .attr('y2', function (d) {
              return insLengthScale(d.ins || 0) + outsLengthScale(d.outs || 0);
            })
            .attr('x1', 0).attr('x2', 0);
          // above
          row.filter(function (d) { return !!d.before; }).append('path')
            .attr('class', 'line')
            .attr('data-pos', 'above')
            .attr('d', function (d) {
              return lineFunc([
                [0, 0],
                [-stopWidth, 0],
                [-stopWidth, -insLengthScale(d.before.ins || 0)],
                [0, -insLengthScale(d.ins || 0)]
              ]);
            })
            .attr('fill', function (d) {
              var to = d.before.key;
              var median = medians[d.key+'|'+to];
              return delayColorScale(d.before.time / median);
            });
          // below
          row.filter(function (d) { return !!d.before; }).append('path')
            .attr('class', 'line')
            .attr('data-pos', 'below')
            .attr('d', function (d) {
              return lineFunc([
                [0, 0],
                [-stopWidth, 0],
                [-stopWidth, insLengthScale(d.before.ins || 0)],
                [0, insLengthScale(d.ins || 0)]
              ]);
            })
            .attr('fill', function (d) {
              var to = d.before.key;
              var median = medians[to + '|' + d.key];
              return delayColorScale(d.before.aftertime / median);
            });

        // -----------------------------------------------
        // Tootips and interactivity
        // -----------------------------------------------
          var tip = d3.tip()
            .attr('class', 'd3-tip')
            .direction('e')
            .offset([0, 0])
            .html(function(d) { return d.name; });
      
          svg.call(tip);

          d3.selectAll('path')
            .on('mouseover', mouseover)
            .on('mousemove', mouseover)
            .on('mouseout', mouseout)
            .on('click.mouseout', mouseout);

          function mouseover(d) {
            var position = d3.select(this).attr('data-pos');
            var text = position === 'above' ? (d.name + ' to ' + d.before.name) : (d.before.name + ' to ' + d.name);
            var extra = '';
            if (position === 'above') {
              text = d.name + ' to ' + d.before.name;
              extra = tripTime(d.before.time);
            } else {
              text = d.before.name + ' to ' + d.name;
              extra = tripTime(d.before.aftertime);
            }

            var parent = d3.select(this.parentNode).datum()
            var y = yScale(parent.time) - rowHeight;
            var coordinates = d3.mouse(d3.select('html').node());
            tip.show(d);
            tip.style('top', (coordinates[1]-17)+'px');
            tip.style('left', (coordinates[0]+15)+'px');
            tip.html(text+"<br>"+extra);
          }

          function mouseout(d) {
            tip.hide();
          }

          // button transitions
          d3.selectAll('.button-together').on('click', function (d) {
               d3.selectAll('.point')
                 .transition()
                 .attr('x', function(d) {
                   var position = d3.select(this).attr("position")
                   return redkeyToIndex[d.key] * stopWidth+gutter+(pointWidth * position);
                 })
               
          })
          d3.selectAll('.button-separate').on('click', function (d) {
            d3.selectAll('.point')
              .transition()
              .attr('x', function(d) {
                var position = d3.select(this).attr("position")
                var startOffset = ((22 * pointWidth) + gutter) * (position -1);
                var index = redkeyToIndex[d.key]
                var xLocation = index * pointWidth;
                return startOffset + xLocation;
              })
          })
    
        });
      });
    });
  });

// stops in order, just the red line for now
function stopLabels(keyData, line) {
  var data  = keyData.nodes.slice(0);
  data = _.filter(data, function (entry) { return _.contains(entry.line, line) });
  data.sort(function (a, b) {
    if (a.sequence < b.sequence) return -1;
    if (a.sequence > b.sequence) return 1;
    return 0;
  });
  return data;
}

function stopKeyToLabel(keyData, line) {
    var data  = {};
    var stopsData = _.filter(keyData.nodes, function (entry) { return _.contains(entry.line, line) });
    _.each(stopsData, function (stop) {
      data[stop.id] = stop.name;
    });
  return data;
}

// array of all time entries
function times(data) {
  var value = data.map(function (d) { return d.time });
  return value;
}

function stopsInLine(timeEntry, line) {
  var lineForArgument = _.filter(timeEntry.lines, function (value) { 
    return line === value.line;
  });
  return lineForArgument[0].stops;
}

// stop list is in keyData form (key, name, sequence, lat/long etc)
function stopIndex(stopList) {
  var stopKeyToIndex = {};
  for (var i=0; i<stopList.length; i++) {
    stopKeyToIndex[stopList[i].id] = i
  }

  return stopKeyToIndex;
}

function tripTime(seconds) {
  if (seconds < 60) {
    return seconds + 's';
  }

  var min = Math.floor(seconds / 60);
  var remainder = seconds - min * 60

  if (remainder === 0) {
    return min+ 'm';
  }

  return min + 'm '+remainder +'s';
}