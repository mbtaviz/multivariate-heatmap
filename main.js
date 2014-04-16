
var rowHeight = 10;
var gutter = 5;
var pointWidth = 7;
var stopWidth = pointWidth * 4 + gutter;

var gridMargin = {top: 20, left: 50, bottom: 0, right: 0};

// progress indicator for our large data file
var text = d3.select('.progress')
  .append('p');
var progress = 0;
var total = 4299274;

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
    
        var svg = d3.select('.graphic').append('svg')
          .attr('height', function (d) { return times(data).length * rowHeight})
          .attr('width', function() { return stopWidth * 22})
        var redLineStops = stopLabels(keyData, "red");
        var redkeyToIndex = stopIndex(redLineStops);
        var redLineKeysToStops = stopKeyToLabel(keyData, "red");
    

        // -----------------------------------------------
        // Scales and Axis
        // -----------------------------------------------
        var xScale = d3.scale.ordinal()
          .domain(redLineStops)
          .range([0, redLineStops.length * (pointWidth*4 + gutter)]);
        var yScale = d3.time.scale()
          .domain([d3.min(times(data)), d3.max(times(data))])
          .range([0, times(data).length * rowHeight])

        var hourAxis = d3.svg.axis()
          .tickFormat(d3.time.format("%-I:%M %p"))
          .ticks(d3.time.hour, 1)
          .scale(yScale)
          .orient("left");
        svg.append('g')
          .attr('class', 'y axis')
          .attr('transform', function () {return 'translate('+(gridMargin.left-1)+', '+gridMargin.top+')'})
          .call(hourAxis);
        var dayAxis = d3.svg.axis()
          .tickFormat(d3.time.format("%a %-m/%-d"))
          .ticks(d3.time.day, 1)
          .scale(yScale)
          .orient("left");
        svg.append('g')
          .attr('class', 'day axis')
          .attr('transform', function () {return 'translate('+(gridMargin.left-1)+', '+(gridMargin.top-13)+')'})
          .call(dayAxis);

    
        // -----------------------------------------------
        // Grid
        // -----------------------------------------------
        // color scales for values
        var insColorScale = d3.scale.linear()
          .domain([0, metrics.turnstile.mean, 100, metrics.turnstile.max])
          .range(['white', '#a1d99b', '#00441b', 'red']); // green
        var outsColorScale = d3.scale.linear()
          .domain([0, metrics.turnstile.mean, 100, metrics.turnstile.max])
          .range(['white', '#9ecae1', '#08306b', 'red']); // blue
  
        // our delay scale is measured in 'medians'.  If
        // the time from station to station is less than or
        // equal to the median value it's in the 0-1 range.
        // 1-2 is median to twice the median, 2-3 is
        // two to three times the median
        var delayScale = d3.scale.linear()
          .domain([0, 1, 2, 3])
          .range(['white', '#f0f0f0','black', 'red'])
    
        var grid = svg.append('g')
          .attr('transform', function (d) { return 'translate('+gridMargin.left+', '+gridMargin.top+')'; });
        
        var row = grid.selectAll('.row')
          .data(data).enter()
            .append('g')
            .attr('class', 'row')
            .attr('transform', function (d) { return 'translate(0,'+yScale(d.time)+')' })
          .selectAll('.entry')
            .data(function (d) {return stopsInLine(d, "red")})
          .enter();
          
          // draw our boxes
          // time to 'before'
          drawPoint(row, 1, delayScale, function (d) {
            if (!d.before) {
              return 0;
            }
            var to = d.before.key;
            var median = medians[d.key+'|'+to];
            return d.before.time / median;
          });      
   
          // ins
           drawPoint(row, 2, insColorScale, function (d) {
             return d.ins;
           })
   
           // outs
           drawPoint(row, 3, outsColorScale, function (d) {
             return d.outs;
           })
 
          // time to 'after'
          drawPoint(row, 4, delayScale, function (d) {
            if (!d.after) {
              return 0;
            }
            var to = d.after.key;
            var median = medians[d.key+'|'+to];
            return d.after.time / median;
          });
          function drawPoint(row, position, colorScale, getData) {
            var rect = row.append('rect')
             .attr('x', function (d) { 
                   var startOffset = ((22 * pointWidth) + gutter) * (position -1);
                   var index = redkeyToIndex[d.key]
                   var xLocation = index * pointWidth;
                   return startOffset + xLocation;
               // return redkeyToIndex[d.key] * stopWidth+gutter+(pointWidth * position)
             })
             .attr('class', 'point')
             .attr('width', pointWidth)
             .attr('height', rowHeight)
             .attr('fill', function (d) { 
               var value = getData(d);
               if (!value) {
                 return colorScale(0)
               } else {
                return colorScale(value); 
              } 
             })
             .attr('value', function (d) { return getData(d) })
             .attr('position', position)
          }

        // -----------------------------------------------
        // Tootips and interactivity
        // -----------------------------------------------
          var tip = d3.tip()
            .attr('class', 'd3-tip')
            .direction('e')
            .offset([0, 0])
            .html(function(d) { return d.name; });
      
          svg.call(tip);

          d3.selectAll('.point')
            .on('mouseover', mouseover)
            .on('mousemove', mouseover)
            .on('mouseout', mouseout)
            .on('click.mouseout', mouseout);

          function mouseover(d) {
            var position = d3.select(this).attr('position');
            var text = d.name;
            var extra = '';
            if (position === '1' && d.before) {
              extra = tripTime(d.before.time) +' to ' + redLineKeysToStops[d.before.key];
            } else if (position === '2') {
              extra = d.ins + ' entrances';
            } else if (position === '3') {
              extra = d.outs + ' exits';
            } else if (position === '4' && d.after) {
              extra = tripTime(d.after.time) +' to ' + redLineKeysToStops[d.after.key];
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
    
        })
      })
    })
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