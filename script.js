// set up =======================================

const w = 900;
const h = 900;

const plot = d3.select(".us-chart")
    .append("svg")
    .attr("width",w)
    .attr("height",h);

const m = {t:32,r:20,b:20,l:20};
const width = w - m.l - m.r;
const height = width / 2;

const voterPromise = d3.json('./data/house-data.json');

function getRepData(data){
    const reps = d3.nest()
      .key(d => d.id)
      .entries(data)
      .map(function(d){
        d.state = d.values[0].state;
        d.repName = d.values[0].repName;
        if (!d.values[0].repEthnicity) {
          d.repEthnicity = "NA"
        } else {
          d.repEthnicity = d.values[0].repEthnicity;
        }
        return d;
      })

    const repsSorted = reps.sort((a,b)=>{
      if(a.repEthnicity < b.repEthnicity) { return 1; }
      if(a.repEthnicity > b.repEthnicity) { return -1; }
      return 0;
    });

  return repsSorted;

}

function getElectorateData(data){

    const electorate = d3.nest()
      .key(d => d.voterEthnicity)
      .rollup(values => d3.sum(values, d => d.voterEthnicityValue))
      .entries(data)

    return electorate;
}

function getEthColor(eth){

  const data = [{
    "ethnicity": "african-american"
    , "color": "#F04E41"
  }, {
    "ethnicity": "asian-american"
    , "color": "#E9A03A"
  }, {
    "ethnicity": "hispanic-american"
    , "color": "#1FB99E"
  }, {
    "ethnicity": "native-american"
    , "color": "#19627C"
  }, {
    "ethnicity": "other-multi-racial"
    , "color": "#C13889"
  }, {
    "ethnicity": "pacific-islander"
    , "color": "#FFD602"
  }, {
    "ethnicity": "white-american"
    , "color": "#4468B1"
  }, {
    "ethnicity": "middle-eastern-american"
    , "color": "#7d7bfe"
  }, {
    "ethnicity": "NA"
    , "color": "#FFFFFF"
  }]
  const colorTmp = data.map(d => {
      return [d.ethnicity,d.color]
    });
  const colorMap = new Map(colorTmp);
  let c = colorMap.get(eth)
  if (!eth) {c = "#FFFFFF";}
  return c;
}

function getState(data, state) {
  return getDistrictsByState(data).filter(d=>d.key==state)[0].values;
}

function getDistrictsByState(data) {

  const districtsByState = d3.nest()
      .key(d =>d.state)
      .key(d =>d.district)
      .entries(data);

  return districtsByState;

}



// dispatch =====================================

const globalDispatch = d3.dispatch("set:grid","set:pillar","change:state");

globalDispatch.on('set:grid', function(state){
    voterPromise.then(data=>{
      drawPlotControl(data,state);
      drawHouseGrid(getRepData(data), getElectorateData(data))
    });
});

globalDispatch.on('set:pillar', function(state){
    voterPromise.then(data=>{
      drawHouseTriangle(getRepData(data), getElectorateData(data))
    });
});

globalDispatch.on('change:state', function(state){
    voterPromise.then(data=>{
      drawPlotControl(data,state);
      drawGrid(getState(data,state))
    });
});

globalDispatch.call('change:state',null,"New York")

globalDispatch.call('set:grid',null)



// controller ===================================

const controller = new ScrollMagic.Controller();
const pos = d3.select(".us-chart").node().getBoundingClientRect();

const scene = new ScrollMagic.Scene({
    offset: 100
	})
  //.addIndicators()
	.on('enter',e=>globalDispatch.call('set:pillar',null))
	.on('leave',e=>{
    if(e.scrollDirection === "REVERSE") {
      globalDispatch.call('set:grid',null)
    }
  })
	.addTo(controller);



// house grid ===================================

function drawHouseGrid(data, electorate){

  const cols = 29;
  const gridWidth = w - (m.l + m.r);
  const interval = gridWidth/cols ;

	const nodesUpdate = plot.selectAll('.rep')
		.data(data, d=>d.key);

	const nodesEnter = nodesUpdate.enter()
    .append("polygon")
    .attr("class","rep");

  nodesEnter
    .on("mouseover",d=>{
      const j = d.values[0];
      const line1 = `${j.repName}, ${j.repParty}`
      const line2 = `${j.state}, District ${j.district}`
      makeToolTip(line1,line2)
    })
    .on("mouseout", destroyToolTip)

	nodesUpdate.merge(nodesEnter)
    .transition()
    .duration(1000)
    .on("start",()=>{
      destroyElectorateTriangle();
    })
    .attr("points",(d,i)=>{
      let xpos = (i % cols) * interval  + m.l;
      let ypos = Math.floor(i/cols) * interval + m.t;
      let twidth = interval-3;
      let theight = (interval-3)/2;
      return `${xpos},${ypos}, ${theight + xpos},${theight + ypos}, ${twidth + xpos},${ypos}`;
    })
    .attr("fill", d=>getEthColor(d.repEthnicity))

	nodesUpdate.exit().remove();
	
	const label = plot.selectAll(".repTitle")
		.data([1]);
		
	const labelEnter = label.enter()
		.append("text")
		.attr("class","repTitle")
		.attr("x",m.l)
		.attr("y",12)
		
	label.merge(labelEnter)	
		.text("116th United States Congress House of Representatives")
    .attr('font-size','12px')
    .style('font-weight','bold')
    .style('font-family','IBM Plex Sans Condensed');
		
	label.exit().remove();	

}



// house triangle ===============================

function drawHouseTriangle(data, electorate){

  const increment = width / data.length;

	const nodesUpdate = plot.selectAll('.rep')
		.data(data, d=>d.key);

	const nodesEnter = nodesUpdate.enter()
    .append("polygon")
    .attr("class","rep");

	nodesUpdate.merge(nodesEnter)
    .transition()
    .duration(1000)
    .on("end",()=>{
      drawElectorateTriangle(electorate)
    })
    .attr("points",(d,i)=>
      `${increment * i + m.l},${m.t},
       ${width / 2 + m.l},${height},
       ${m.l + width},${m.t}`
			// Better, but makes morray pattern
			//{
			// let left = (increment * i) + m.l;
			// let right = (increment * i) + m.l + increment;
			// return `${Math.floor(left)},${m.t + m.t},${width / 2 + m.l},${height},${Math.ceil(right)},${m.t + m.t}`;
			//}
    )
    .attr("fill", d=>getEthColor(d.repEthnicity))

	nodesUpdate.exit().remove();

}



// electorate triangle ==========================

function drawElectorateTriangle(data){

  data = data.sort((a,b) => b.value - a.value);

  const increment = width / data.length;

  const scaleData = d3.scaleLinear()
    .domain([0, d3.sum(data, d=>d.value)])
    .rangeRound([0,width]);

	const nodesUpdate = plot.selectAll('.voter')
		.data(data);

	const nodesEnter = nodesUpdate.enter()
    .append("polygon")
    .attr("class","voter")

  nodesEnter
    .attr("opacity", 0)
    .transition()
    .duration(1000)
    .attr("opacity", 1)

  nodesEnter
    .on("mouseover",d=>{
      const line1 = d.key;
      const line2 = addCommas(d.value);
      makeToolTip(line1,line2)
    })
    .on("mouseout", destroyToolTip)

	nodesUpdate.merge(nodesEnter)
    .attr("points",(d,i)=>{
      let left = scaleData(d3.sum(data.slice(0,i),d=>d.value));
      let right = scaleData(d.value);
      let xpos = scaleData(d.value);
      let ypos = width/2;
      return `${m.l + left},${height + ypos},
              ${m.l + (width/2)},${ypos},
              ${m.l + left + right},${height + ypos}`;
    })
    .attr("fill", d=>getEthColor(d.key))
    .attr("id",d=>d.key)
    .attr("data-val",d=>d.value);

	nodesUpdate.exit().remove();
	
	
	const label = plot.selectAll(".voterTitle")
		.data([1]);
		
	const labelEnter = label.enter()
	
		.append("text")
		.attr("class","voterTitle")
		.attr("x",m.l)
		.attr("y",(height * 2) + 28)
		
	labelEnter
	   .attr("opacity", 0)
    .transition()
    .duration(1000)
    .attr("opacity", 1)

		
	label.merge(labelEnter)	
		.text("US Electorate")
    .attr('font-size','12px')
    .style('font-weight','bold')
    .style('font-family','IBM Plex Sans Condensed');
		
	label.exit().remove();		

}

function destroyElectorateTriangle(){
  d3.selectAll('.voter')
    .remove();
}



// control ======================================

function drawPlotControl(data,state=null){

	const stateList = getDistrictsByState(data).map(d => d.key);

	let menu = d3.select(".ui-select")
    .selectAll("select")
    .data([1]);

	menu = menu.enter()
    .append("select")
    .attr("class","select-control")
		.merge(menu);

	menu.selectAll("option")
    .data(stateList)
    .enter()
    .append("option")
    .attr("value", d => d)
    .attr("selected", d=>{
      if (d === state){
        return "selected"
      }
    })
    .html(d => d)

	menu.exit().remove();

	menu.on('change', function(){
		globalDispatch.call('change:state',null,this.value);
	});

}



// district grid ================================

function drawGrid(data) {

  const w = 230;
  const h = 230;

  const dom = d3.select(".state-plot");

  const nodes = dom.selectAll(".chart")
    .data(data);

  const nodesEnter = nodes.enter()
    .append("svg")
    .attr("class","chart")
    .attr("width",w)
    .attr("height",h)

  nodes.merge(nodesEnter)
    .each(function(d){
      drawVoters(this,d.values);
    })

  nodes.exit()
    .transition()
    .duration(500)
    .style("opacity",0)
    .remove();

}



// voters triangle ==============================

function drawVoters(dom,data){

  // bug: this doesn't appear to be working: stacking order is wrong.
  dataSorted = data.sort((a,b) => a.voterEthnicityValue - b.voterEthnicityValue);

  const plot = d3.select(dom);
  const w = dom.clientWidth;
  const h = dom.clientHeight;
  const baseline = 100; // adjust vertical position

  const center = {x: w/2, y: baseline};
  const dist = 75;

  // goal = usTotal / 435
  // 325014505 / 435 = 747160
  const ethSum = d3.sum(data,d=>d.voterEthnicityValue)
  const ratio = ethSum / 747160;

  // sohtahcoa
  const theta = degToRad(45);
  const opp = dist * ratio;
  const hyp = opp / Math.sin(theta);

  // use height as measure
  const bVertex = findPoint(center, degToRad(270), 0);
  const bLeft = findPoint(center, degToRad(270 + 45), hyp);
  const bRight = findPoint(center, degToRad(270 - 45), hyp);

  // scaling function
  const scaleEthData = d3.scaleLinear()
    .domain([0, d3.sum(data, d=>d.voterEthnicityValue)])
    .rangeRound([0,bRight.x-bLeft.x]);

  // adjust
  const ay = center.y - bRight.y + 100;

  /* At this point I had to bread enter exit update
   * because the sort order wasn't updating.
   * I could fix this by not drawing overlapping
   * shapes.
   */

  const nodesRemove = plot.selectAll(".node")
    .remove();

  const nodesFresh = plot.selectAll(".node")
    .data(dataSorted, d=>d.voterEthnicity)
    .enter()
    .append("polygon")
    .attr("class","node")
    .attr("points",(d,i)=>{
      let left = scaleEthData(d3.sum(dataSorted.slice(0,i),d=>d.voterEthnicityValue));
      let right = scaleEthData(d.voterEthnicityValue);
      return `${bLeft.x + left},${bLeft.y + ay}, ${bVertex.x},${bVertex.y + ay}, ${bLeft.x + left + right},${bRight.y + ay}`;
    })
    .attr("data-state",d=>d.state)
    .attr("data-ethnicity",d=>d.voterEthnicity)
    .attr("data-ethnicity-value",d=>d.voterEthnicityValue)
    .attr("fill", d=>getEthColor(d.voterEthnicity));

  nodesFresh
    .on("mouseover",d=>{
      const line1 = d.voterEthnicity;
      const line2 = addCommas(d.voterEthnicityValue);
      makeToolTip(line1,line2)
    })
    .on("mouseout", destroyToolTip)

  drawRep(dom,[dataSorted[0]],ay);

}



// rep triangle =================================

function drawRep(dom,data,ay){

  data = data[0];

  const plot = d3.select(dom);
  const w = dom.clientWidth;
  const h = dom.clientHeight;
  const baseline = 100; // adjust vertical position

  const center = {x: w/2, y: baseline};
  const dist = 75;

  // get triangle points
	// let angleA = data.repPct * 45; // limit to angle
  let angleA = (1 - data.repPct) * 90; // limit to angle
  if (data.repParty == "D") {
    angleA = angleA * -1;
  }

  const gVertex = findPoint(center, degToRad(90), 0);

  // get triangle points
  const aVertex = findPoint({x:0,y:0}, degToRad(90), 0);
  const aLeft = findPoint({x:0,y:0}, degToRad(90 + 45), dist);
  const aRight = findPoint({x:0,y:0}, degToRad(90 - 45), dist);

  // position for labels
  const textAngle = findAngleAB(aLeft, aRight);
  const textPos = findPoint(aLeft, textAngle + 90, 0);

  const gRemove = plot.selectAll(".distGroup")
    .remove();

	const g = plot.append("g")
		.attr("class","distGroup")
		.attr("transform",`translate(${gVertex.x},${gVertex.y + ay})`)

	g.exit().remove();

	const gg = g.append("g")
	
	gg.transition()
		.duration(3000)
		.ease(d3.easeElasticOut)
		.attr("transform",`rotate(${angleA})`)
		
	gg.exit().remove();

  // rep label
  const repLabel = gg.selectAll('.repLabel')
    .data([data]);

  const repLabelEnter = repLabel.enter()
    .append('text')
    .attr('class', 'repLabel')
    .datum(data)

  repLabel.merge(repLabelEnter)
    .text(d=>`Rep. ${d.repName}, ${d.repParty}`)
    .attr('x',textPos.x)
    .attr('y',textPos.y - 20)
    .attr('font-size','8px')
    .style('font-weight','bold')
    .style('font-family','IBM Plex Sans Condensed');

  repLabel.exit()
    .remove();

  // district label
  const distLabel = gg.selectAll('.distLabel')
    .data([data]);

  const distLabelEnter = distLabel.enter()
    .append('text')
    .attr('class', 'distLabel')
    .datum(data)

  distLabel.merge(distLabelEnter)
    .text(d=>`${d.state}, District ${d.district}`)
    .attr('x',textPos.x)
    .attr('y',textPos.y - 8)
    .attr('font-size','8px')
    .style('font-weight','regular')
    .style('font-family','IBM Plex Sans Condensed')

  distLabel.exit()
    .remove();

  // rep plot
  const rep = gg.selectAll('.rep')
    .data([data]);

  const repEnter = rep.enter()
    .append('polygon')
    .attr('class', 'rep')
    .datum(data)

  repEnter
    .on("mouseover",d=>{
      const line1 = "Received";
      const line2 = `${Math.round(d.repPct * 100) }% of the vote`;
      makeToolTip(line1,line2)
    })
    .on("mouseout", destroyToolTip)

  rep.merge(repEnter)
    .attr("points",`${aLeft.x},${aLeft.y}, ${aVertex.x},${aVertex.y}, ${aRight.x},${aRight.y}`)
    .attr("fill", d=>getEthColor(d.repEthnicity))
    .attr("data-state",d=>d.state);

  rep.exit().remove();

}



// Tooltip ======================================

function makeToolTip(line1,line2=null){

  const dom = d3.select("body");
  const tt = dom.selectAll(".tooltip")
    .data([1]);
  const ttEnter = tt.enter()
    .append("div")
    .attr("class","tooltip")
  tt.merge(ttEnter)
    .html(line1 + "<br>" + line2)
    .style("left",`${d3.event.pageX + 20}px`)
    .style("top",`${d3.event.pageY}px`)
}

function destroyToolTip(){
  d3.selectAll(".tooltip").remove();
}



// Utility funcitons ============================

function degToRad(degrees){
  return degrees * (Math.PI/180);
}

function radToDeg(radians){
  return radians * (180/Math.PI);
}

function findPoint(center, angleRad, distance){
  return {
    x: Math.cos(-angleRad) * distance + center.x,
    y: Math.sin(-angleRad) * distance + center.y
  }
}

function findAngleAB(a,b){
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function addCommas(nStr){
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}
