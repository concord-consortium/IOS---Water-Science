function toast (msg) {setTimeout(function() {toaster(msg).delay( 3000 )
	.fadeOut( 400, function(){
		$(this).remove();
	});}, 0);
};

function toaster (msg){
    if (waterScience.toast) waterScience.toast.remove();
	return $("<div class='ui-loader ui-overlay-shadow ui-body-e ui-corner-all'><h3>"+msg+"</h3></div>")
	.css({ display: "block", 
		background: "#ffffff", 
		position: "fixed",
		padding: "7px",
		"text-align": "center",
		width: "270px",
		left: ($(window).width() - 284)/2,
		top: $(window).height()/2 })
	.appendTo( $.mobile.pageContainer );
};

var waterScience = {
doGPS: "off",
doCamera: "on",
database: "true",
errorLoc: "",
context: {contribution_key: null,contributor_name: null,fields: []}, 
uploadURL: "",
toast: null,

init : function () {
waterScience.errorLoc = "Init";
  waterScience.database = openDatabase("data", "1.0", "data manager", 5 * 1024 * 1024);
  waterScience.database.transaction(function(tx) {
    tx.executeSql("CREATE TABLE IF NOT EXISTS KEYVALUES (KEYNAME TEXT PRIMARY KEY ASC, KEYVALUE TEXT)");
  });
  waterScience.getContext('context', function (result) {
      try {
    if (result != undefined) waterScience.context=JSON.parse(result);
    else {
  waterScience.context.contributor_name = $("#contributionName").val("Water Science").val();
  waterScience.context.contribution_key = $("#contributionKey").val(1234).val();
  waterScience.context.projectNumber = $("#projectNumber").val(862).val();
        waterScience.saveSettings();
    }
    waterScience.uploadURL = "http://isenseproject.org/api/v1/projects/"+waterScience.context.projectNumber+"/jsonDataUpload"
      waterScience.updateHTML();
      waterScience.reSendData();

//    if (waterScience.context.contribution_key == undefined || waterScience.context.contributor_name == undefined) 
//        $.mobile.changePage($('#pageSettings'), {transition: 'none'}); 
      } catch(err) {waterScience.onError(err);}
    }
  );
},

updateHTML: function () {
  $("#contributionKey").val(waterScience.context.contribution_key);
  $("#contributionName").val(waterScience.context.contributor_name);
  $("#projectNumber").val(waterScience.context.projectNumber);
       var rowOutput="";
   
      for (i=0; i<waterScience.context.fields.length; i++) {
        if (waterScience.context.fields[i][0] == "Longitude") {
            rowOutput += waterScience.inputHidden(i);
            waterScience.Longitude = waterScience.context.fields[i][1];
            waterScience.doGPS = "on";
        }
        else if (waterScience.context.fields[i][0] == "Latitude") {
             rowOutput += waterScience.inputHidden(i);
             waterScience.Latitude = waterScience.context.fields[i][1];
             waterScience.doGPS = "on";
        } else if (waterScience.context.fields[i][3] != null) {
            rowOutput += waterScience.inputSelect(i);
        } else {
            rowOutput += waterScience.inputText(i);
        }
      }
      $("#dataFields").html("<table><tr><td>Data Set Description</td><td><input type=text id=datasetname></td></tr>" + rowOutput + "</table>");
},

inputSelect: function (i) {
    selectList = "";
    for (x in waterScience.context.fields[i][3]) {
        selectList += '<option>' + waterScience.context.fields[i][3][x] + '</option>';
    }
    return '<tr><td>' + waterScience.context.fields[i][0] + '</td><td><select name="F' + 
            waterScience.context.fields[i][1]  + '" id="F' + waterScience.context.fields[i][1]+ '">' + selectList + '</select></td></tr>'; 
},

inputText: function (i){
waterScience.errorLoc = "inputText";
         return '<tr><td>' + waterScience.context.fields[i][0] + '</td><td>' + 
		     '<input type="'+waterScience.context.fields[i][2]+'" name="F' + waterScience.context.fields[i][1]+ 
		     '" id="F' + waterScience.context.fields[i][1]+ '"></td></tr>';
},

inputHidden: function (i){
waterScience.errorLoc = "inputHidden";
         return  '<tr><td></td><td>' + 
         '<input type="hidden" name="F' + waterScience.context.fields[i][1] + 
		     '" id="F' + waterScience.context.fields[i][1]+ '"></td></tr>';
},
inputSlider: function (i){
waterScience.errorLoc = "inputSlider";
         return '<tr><td>' + waterScience.context.fields[i][0] + '</td><td>' + 
		     '<input type="range" name="F' + waterScience.context.fields[i][1]+ 
		     '" id="F' + waterScience.context.fields[i][1]+ '"></td></tr>';
},

saveData: function () {
   try {
waterScience.errorLoc = "saveData";
//      if (waterScience.doCamera == "on") {
        navigator.camera.getPicture(onSuccess, function(message) {
				toast('Failed to get a picture');
		}, { quality: 40,
        destinationType: Camera.DestinationType.FILE_URI });

        function onSuccess(imageURI) {
          waterScience.toast = toaster("Getting Location");
          waterScience.imageURI = imageURI;
          if (waterScience.doGPS == "on") {
            navigator.geolocation.getCurrentPosition(waterScience.saveGPS, waterScience.noGPS, {maximumAge:Infinity, timeout:10000, enableHighAccuracy: true});
          } else {
            waterScience.saveLocal ();
          }
        }
//      } else {
//        waterScience.saveLocal ();
//      } 
   } catch(err) {toast("SaveData -- " + err.message);}
},

saveGPS:  function(gps) {
waterScience.errorLoc = "saveGPS";
            if (waterScience.toast) waterScience.toast.remove();
            $("#F" + waterScience.Longitude).val(gps.coords.longitude);
            $("#F" + waterScience.Latitude).val(gps.coords.latitude);
			waterScience.saveLocal ();
},

noGPS:  function(gps) {
waterScience.errorLoc = "noGPS";
            if (waterScience.toast) waterScience.toast.remove();
            $("#F" + waterScience.Longitude).val(0);
            $("#F" + waterScience.Latitude).val(0);
			waterScience.saveLocal ();
},

saveLocal:  function() {
waterScience.errorLoc = "saveLocal";
         waterScience.toast = toaster("Uploading");
         waterScience.database.transaction(function(tx){
           try {
             var i, fieldList = "added_on,IMAGEURI,DATASETNAME", dummyValues = "?,?,?", 
                    values=[new Date(), waterScience.imageURI, $('#datasetname').val()];
             for (i=0; i<waterScience.context.fields.length; i++) {
               fieldList += ",F" + waterScience.context.fields[i][1];
               if (waterScience.context.fields[i][2] == "number")
               values.push ($("#F"+waterScience.context.fields[i][1]).val().replace(/[^\d.-]/g, ''));
               else values.push ($("#F"+waterScience.context.fields[i][1]).val());
               dummyValues += ",?";
             }
             tx.executeSql("INSERT INTO data("+fieldList+") VALUES ("+dummyValues+")",
                 values,
                 onSaved,
                 waterScience.onError);
           } catch(err) {toast("Save Local -- " + err.message)};
         });

         function onSaved (tx, results) {
			 waterScience.updateList();
             waterScience.uploadRemote(results.insertId);
         }
},

uploadRemote: function (id) {
           waterScience.errorLoc = "uploadRemote";
           waterScience.database.transaction(function (tx) {
             tx.executeSql("SELECT * FROM data WHERE ID='"+ id +"'", [], function (tx, results) {
               var data={}; 
               var row = results.rows.item(0);
               for (i=0; i<waterScience.context.fields.length; i++) {
                 data[waterScience.context.fields[i][1]] = [row["F"+waterScience.context.fields[i][1]]];
               }
               var upload={
                   "contribution_key": waterScience.context.contribution_key,
                   "contributor_name": waterScience.context.contributor_name,
                   'title': row.DATASETNAME + ' - ' + (new Date()).getTime().toString(),
                   'data': data
               };
               $.post(waterScience.uploadURL, upload)
                   .done(function(data) {
                     waterScience.database.transaction(function (tx) {
                       tx.executeSql("UPDATE data SET DATAID='"+data.id.toString()+"' WHERE ID='"+ id +"'", [], waterScience.updateList(),waterScience.onError);
                     });
                     window.resolveLocalFileSystemURL(row.IMAGEURI, function(fileEntry) {
                       try {
                         var options = new FileUploadOptions();
                         options.fileKey = "upload";
                         options.chunkedMode = false;
                         options.fileName = row.IMAGEURI.substr(row.IMAGEURI.lastIndexOf('/') + 1);
                      options.mimeType = "image/jpeg";
                         options.params = {
                           "contribution_key": waterScience.context.contribution_key,
                           "contributor_name": waterScience.context.contributor_name,
                           "type": "data_set",
                           "id": data.id.toString()
                         };
                         options.headers = {Connection: "Close"};
                         var ft = new FileTransfer();
                         ft.upload(fileEntry.toInternalURL(), encodeURI("http://isenseproject.org/api/v1/media_objects/")
                                       , function(r) {toast("Uploaded");}
                                       , function(error) {toast("Upload Fail -> " + error.code + " " + error.source);}
                                       , options);
                       } catch(err) {toast(err.message);}
                     }, function (e) {
                       toast ("File Error - " + e.message);
                     }          
                 );
               })
               .fail(function(data) {
                       if (data.status == 401) toast ("Invalid Contributor Code")
                       else if (data.status == 422) toast ("iSense Server Error")
                       else toast("No Internet (" + data.status +")");
                   });
             }, waterScience.onError);
           });
},

updateList: function (){
waterScience.errorLoc = "updateList";
   waterScience.database.transaction(function (tx) {
     tx.executeSql("SELECT * FROM data ORDER BY ID DESC", [], function (tx, results) {
 try {
       var rowOutput = "", i;
       for (i = 0; i < results.rows.length; i++){
         var row = results.rows.item(i);
         var date = new Date(row.added_on);
         var status = "Uploaded";
         if (row.DATAID == null) status = "Pending";
         rowOutput += "<li><a href='javascript:void(0);'onclick='waterScience.showData(" + row.ID +");'>" + 
         (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + 
         date.getHours() + ":" + date.getMinutes() +" - "+ status + '</a>';
         // + " [<a href='javascript:void(0);'  onclick='waterScience.deletedata(" + row.ID +");'>Delete</a>]</li>";
       }
       $("#dataHistory").html(rowOutput);
 } catch(err) {toast("Update List -- " + err.message);}
     });
   }, waterScience.onError);
},

showData: function (id){
waterScience.errorLoc = "showData";
   waterScience.database.transaction(function (tx) {
      tx.executeSql("SELECT * FROM data WHERE ID='"+ id +"'", [], function (tx, results) {
        try {
          var data={}, dataHTML=""; 
          var row = results.rows.item(0);
          var date = new Date(row.added_on);
          $("#dataName").html((date.getMonth()+1) + "/" + date.getDate() + 
          "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes());
          for (i=0; i<waterScience.context.fields.length; i++) {
            dataHTML += '<tr><td><b>' + waterScience.context.fields[i][0] + '</b></td><td>' + 
                          row["F"+waterScience.context.fields[i][1]] + '</td></tr>';
          }
          $("#dataValues").html("<table style='border-spacing:5px'><tr><td><b>Data Set Description</b></td><td style='margin:2em;width:30em'>"+row.DATASETNAME+"</td></tr>" +
                                 dataHTML + "</table>");
          $.mobile.changePage($('#data'), {});
        } catch(err) {toast(err.message);}
     });
   }, waterScience.onError);
},

reSendData: function () {
   waterScience.errorLoc = "reSendData";
   waterScience.database.transaction(function (tx) {
     tx.executeSql("SELECT * FROM data WHERE DATAID IS NULL", [], function (tx, results) {
       for (i = 0; i < results.rows.length; i++){
         var row = results.rows.item(i);
         waterScience.uploadRemote (row.ID);
       }
       waterScience.updateList();
     });
   }, function () {/*$.mobile.changePage($('#pageSettings'), {});*/});
},

deletedata: function(id) {
  waterScience.database.transaction(function(tx){
    tx.executeSql("DELETE FROM data WHERE ID=?", [id],
        waterScience.updateList,
        waterScience.onError);
    });
},
  
saveSettings: function (){
waterScience.errorLoc = "saveSettings";
  waterScience.context.contributor_name = $("#contributionName").val();
  waterScience.context.contribution_key = $("#contributionKey").val();
  waterScience.context.projectNumber = $("#projectNumber").val();
  waterScience.uploadURL = "http://isenseproject.org/api/v1/projects/"+waterScience.context.projectNumber+"/jsonDataUpload"
  waterScience.setContext('context', JSON.stringify(waterScience.context));
  waterScience.context.projectNumber = $("#projectNumber").val();

  $.get("http://isenseproject.org/api/v1/projects/" + waterScience.context.projectNumber, 
     function(data, status){
      try {
       var fieldTypes = ["text","text","number","text","number","number"];
       waterScience.context.fields = [];
       for (i=0; i< data.fields.length; i++ ) {
          if (data.fields[i]["type"] > 5) data.fields[i]["type"] = 0;
          waterScience.context.fields.push([data.fields[i]["name"], data.fields[i]["id"].toString(), fieldTypes[data.fields[i]["type"]], data.fields[i]["restrictions"]]);
        }
        var fieldList = "";
        for (i=0; i<waterScience.context.fields.length; i++) 
           fieldList += ",F" + waterScience.context.fields[i][1] + " TEXT";
        if (fieldList != waterScience.context.fieldList) {
          waterScience.database.transaction(function(tx) {
            tx.executeSql("DROP TABLE IF EXISTS data");
            tx.executeSql("CREATE TABLE IF NOT EXISTS data(ID INTEGER PRIMARY KEY ASC, added_on DATETIME, DATAID TEXT, IMAGEURI TEXT, DATASETNAME TEXT"+fieldList+")");
          });
          waterScience.context.fieldList = fieldList;
        }
        waterScience.setContext('context', JSON.stringify(waterScience.context));
        waterScience.updateHTML();
        waterScience.updateList();
        $.mobile.changePage($('#home'), {
              transition: 'flip',
              reverse: true}); 
      } catch(err) {toast(err.message)};
  });
},

setContext: function (name,keyValue){
waterScience.errorLoc = "setContext";
try {
  waterScience.database.transaction(function(tx){
    tx.executeSql("INSERT OR REPLACE INTO KEYVALUES (KEYNAME,KEYVALUE) VALUES ('"+name+"','"+keyValue+"')", [], null, 
                 waterScience.onError);
 });
} catch(err) {toast(err.message);}

    return keyValue;
},
  
getContext: function (name, callback){
waterScience.errorLoc = "getContext";
 try {
  var result;
  waterScience.database.transaction(function(tx){
   tx.executeSql("SELECT KEYVALUE FROM KEYVALUES WHERE KEYNAME = '"+name+"'", [], function (tx, results) {
		if (results.rows.length != 0)  callback ((results.rows.item(0)).KEYVALUE);
        else                           callback (undefined);
	}, waterScience.onError);
  });
 } catch(err) {toast(err.message);}
},
  
onError : function (error) {
        toast("Error="+waterScience.errorLoc + "--" + error.message);
    },
};



