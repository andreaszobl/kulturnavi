var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');

/**
 * Add a click handler to hide the popup.
 * @return {boolean} Don't follow the href.
 */
closer.onclick = function() {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

var overlay = new ol.Overlay( /** @type {olx.OverlayOptions} */ ({
  element: container,
  autoPan: true,
  autoPanAnimation: {
    duration: 250
  }
}));

var vectorSourceImages = new ol.source.Vector({
  //defaultProjection: 'EPSG:4326',
  //projection: 'EPSG:4326'
  projection: 'EPSG:3857'
});

/*
    var vectorLayerImages = new ol.layer.Vector({
      source: vectorSourceImages,
      style: styleFunction
    });
*/
var clusterSource = new ol.source.Cluster({
  distance: 30,
  source: vectorSourceImages,
});

var styleCache = {};
var clusters = new ol.layer.Vector({
  source: clusterSource,
  style: function(feature, resolution) {
    var size = feature.get('features').length;
    var style = styleCache[size];

    var radius = Math.log(size) * 2 + 12 + (1 / resolution * 2);
    if (radius > 27) {
      radius = 27;
    }
    if (!style) {
      style = [new ol.style.Style({
        image: new ol.style.Circle({
          radius: radius,
          stroke: new ol.style.Stroke({
            color: '#fff'
          }),
          fill: new ol.style.Fill({
            color: '#3399CC'
          })
        }),
        text: new ol.style.Text({
          text: size.toString(),
          fill: new ol.style.Fill({
            color: '#fff'
          })
        })
      })];
      styleCache[size] = style;
    }
    return style;
  }
});


var view = new ol.View({
  center: ol.proj.transform([15.397911071777, 47.070865631104], 'EPSG:4326', 'EPSG:3857'),
  projection: 'EPSG:3857',
  zoom: 10
});

var map = new ol.Map({
  layers: [
    clusters
  ],
  controls: ol.control.defaults({
    attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
      collapsible: false
    })
  }),
  target: 'map',
  overlays: [overlay],

  interactions: ol.interaction.defaults().extend([
    new ol.interaction.Select({
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 10,
          fill: new ol.style.Fill({
            color: 'red'
          }),
          stroke: new ol.style.Stroke({
            color: 'white',
            width: 4
          })
        })
      })
    })
  ]),

  view: view
});






var capabilitiesUrl = 'http://www.basemap.at/wmts/1.0.0/WMTSCapabilities.xml';

// HiDPI support:
// * Use 'bmaphidpi' layer (pixel ratio 2) for device pixel ratio > 1
// * Use 'geolandbasemap' layer (pixel ratio 1) for device pixel ratio == 1
var hiDPI = ol.has.DEVICE_PIXEL_RATIO > 1;
var layer = hiDPI ? 'bmaphidpi' : 'geolandbasemap';
var tilePixelRatio = hiDPI ? 2 : 1;

$.ajax(capabilitiesUrl).then(function(response) {
  var result = new ol.format.WMTSCapabilities().read(response);
  var options = ol.source.WMTS.optionsFromCapabilities(result, {
    layer: layer,
    matrixSet: 'google3857',
    requestEncoding: 'REST',
    style: 'normal',
    //attributions: [attribution],


  });
  options.tilePixelRatio = tilePixelRatio;
  options.attributions = new ol.Attribution({
    html: '<a href="http://www.geoportail.fr/" target="_blank">' +
      '<img src="http://api.ign.fr/geoportail/api/js/latest/' +
      'theme/geoportal/img/logo_gp.gif"></a>'
  });
  var wmtslayer = new ol.layer.Tile({
    source: new ol.source.WMTS(options)
  });
  map.addLayer(wmtslayer);

  map.getLayers().insertAt(99, clusters);
});





$.getJSON("data/test.json", function(data) {
  console.log("data.count: " + data.count);
  var features = [];

  $.each(data.entries, function(key, val) {
    var lon = parseFloat(val['longitude']);
    var lat = parseFloat(val['latitude']);
    var name = val['name'];

    var iconFeature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857')),

      name: name
    });
    features.push(iconFeature);

  });
  vectorSourceImages.addFeatures(features);

});


var styleFunction = function(feature, resolution) {
  return [new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: 'red',
      width: 3
    }),
    fill: new ol.style.Fill({
      color: 'rgba(255, 0, 0, 0.1)'
    }),
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({
        color: 'rgba(200, 0, 0, 0.1)'
      }),
      stroke: new ol.style.Stroke({
        color: 'orange',
        width: 1
      })
    })
  })];
};


map.on('click', function(evt) {

  //map.zoomIn();
  var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    return feature;
  });


  if (typeof feature != 'undefined') {
    var features = feature.get('features');

    var extent_feature;
    var extent_cluster;

    if (isCluster(feature)) {
      overlay.setPosition(undefined);
      // is a cluster, so loop through all the underlying features

      // getextent of clusterfeature
      extent_cluster = feature.getGeometry().getExtent();

      for (var i = 0; i < features.length; i++) {
        console.log(features[i]);
        console.log(features[i].get('name'));
        extent_feature = features[i].getGeometry().getExtent();
        if (extent_feature[0] < extent_cluster[0]) extent_cluster[0] = extent_feature[0];
        if (extent_feature[1] < extent_cluster[1]) extent_cluster[1] = extent_feature[1];
        if (extent_feature[2] > extent_cluster[2]) extent_cluster[2] = extent_feature[2];
        if (extent_feature[3] > extent_cluster[3]) extent_cluster[3] = extent_feature[3];
      }

      extent_cluster[0] -= 50;
      extent_cluster[1] -= 50;
      extent_cluster[2] += 50;
      extent_cluster[3] += 50;
      map.getView().fit(extent_cluster, map.getSize());
      console.log(extent_cluster);

    } else {
      // not a cluster
      console.log(features);
      var featurename = features[0].get('name');

      var featureid = features[0].get('id');
      content.innerHTML = '<p><a href="#" data-gw-name="' + featurename + '" data-gw-id="' + featureid + '" class="popuplink" onclick="showMessage(' + featureid + ')">' + featurename + '</a></p>';

      var geometry = feature.getGeometry();
      var coord = geometry.getCoordinates();

      overlay.setPosition(coord);
      var pan = ol.animation.pan({
        duration: 400,
        source: /** @type {ol.Coordinate} */ (view.getCenter())
      });
      map.beforeRender(pan);
      map.getView().setCenter(coord);
    }
  }
});

function isCluster(feature) {
  if (!feature || !feature.get('features')) {
    return false;
  }
  return feature.get('features').length > 1;
}
