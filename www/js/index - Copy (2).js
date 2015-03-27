var waterScience = {
doGPS: "off",
doCamera: "on",
database: "true",
errorLoc: "",
context: {contribution_key: null,contributor_name: null,fields: []}, 
uploadURL: "",

init : function () {
waterScience.errorLoc = "Init";
  waterScience.database = openDatabase("data", "1.0", "data manager", 5 * 1024 * 1024);
  waterScience.database.transaction(function(tx) {
    tx.executeSql("CREATE TABLE IF NOT EXISTS KEYVALUES (KEYNAME TEXT PRIMARY KEY ASC, KEYVALUE TEXT)");
  });
  waterScience.getContext('context', function (result) {
      try {
    if (result != undefined) waterScience.context=JSON.parse(result);
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
//  alert (waterScience.context.contributor_name +"="+ $("#contributionName").val());
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
        } else {
            rowOutput += waterScience.inputText(i);
        }
//         alert(waterScience.inputText(i));
      }
      $("#dataFields").html("<table>" + rowOutput + "</table>");
},

inputText: function (i){
waterScience.errorLoc = "inputText";
         return '<tr><td>' + waterScience.context.fields[i][0] + '</td><td>' + 
		     '<input type="text" name="F' + waterScience.context.fields[i][1]+ 
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
				alert('Failed to get a picture');
		}, { quality: 50,
        destinationType: Camera.DestinationType.FILE_URI });

        function onSuccess(imageURI) {
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
   } catch(err) {alert(err.message);}
},

saveGPS:  function(gps) {
waterScience.errorLoc = "saveGPS";
            $("#F" + waterScience.Longitude).val(gps.coords.longitude);
            $("#F" + waterScience.Latitude).val(gps.coords.latitude);
//            alert (gps.coords.longitude+"="+gps.coords.latitude);
			waterScience.saveLocal ();
},

noGPS:  function(gps) {
waterScience.errorLoc = "noGPS";
            $("#F" + waterScience.Longitude).val(0);
            $("#F" + waterScience.Latitude).val(0);
			waterScience.saveLocal ();
},

saveLocal:  function() {
waterScience.errorLoc = "saveLocal";
         waterScience.database.transaction(function(tx){
           try {
             var i, fieldList = "added_on,IMAGEURI", dummyValues = "?,?", values=[new Date(), waterScience.imageURI];
             for (i=0; i<waterScience.context.fields.length; i++) {
               fieldList += ",F" + waterScience.context.fields[i][1];
               values.push ($("#F"+waterScience.context.fields[i][1]).val());
               dummyValues += ",?";
//               alert ("#F"+waterScience.context.fields[i][1]+"="+$("#F"+waterScience.context.fields[i][1]).val());
             }
             tx.executeSql("INSERT INTO data("+fieldList+") VALUES ("+dummyValues+")",
                 values,
                 onSaved,
                 waterScience.onError);
           } catch(err) {alert(err.message)};
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
                   'title': (new Date()).getTime().toString(),
                   'data': data
               };
//alert(JSON.stringify(upload))
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
//                      options.mimeType = "image/jpeg";
                         options.params = {
                           "contribution_key": waterScience.context.contribution_key,
                           "contributor_name": waterScience.context.contributor_name,
                           "type": "data_set",
                           "id": data.id.toString()
                         };
                         options.headers = {Connection: "Close"};
                         var ft = new FileTransfer();
                         ft.upload(fileEntry.toInternalURL(), encodeURI("http://isenseproject.org/api/v1/media_objects/")
                                       , function(r) {alert("Saved");}
                                       , function(error) {alert("fail -> " + error.code + " " + error.source);}
                                       , options);
                       } catch(err) {alert(err.message);}
                     }, function (e) {
                       alert ("File Error - " + e.message);
                     }          
                 );
               })
               .fail(function(data) {alert(data.status);});
             }, waterScience.onError);
           });
},

updateList: function (){
waterScience.errorLoc = "updateList";
 try {
   waterScience.database.transaction(function (tx) {
     tx.executeSql("SELECT * FROM data WHERE DATAID IS NULL ORDER BY DATAID DESC", [], function (tx, results) {
       var rowOutput = "", i;
       for (i = 0; i < results.rows.length; i++){
         var row = results.rows.item(i);
         var date = new Date(row.added_on);
         var status = "Uploaded";
         if (row.DATAID == null) status = "Pending";
         rowOutput += "<li>" + (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() +" - "+ status;
         // + " [<a href='javascript:void(0);'  onclick='waterScience.deletedata(" + row.ID +");'>Delete</a>]</li>";
       }
       $("#dataHistory").html(rowOutput);
     }, waterScience.onError);
   });
 } catch(err) {alert(err.message);}
},

reSendData: function () {
   waterScience.errorLoc = "reSendData";
   waterScience.database.transaction(function (tx) {
     tx.executeSql("SELECT * FROM data WHERE DATAID IS NULL", [], function (tx, results) {
       for (i = 0; i < results.rows.length; i++){
         var row = results.rows.item(i);
//          $.each(row, function (key, val) {alert("Name="+key);});
//         alert ("ID=" + row.ID);
         waterScience.uploadRemote (row.ID);
       }
       waterScience.updateList();
     }, waterScience.onError);
   });
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
  waterScience.context.projectNumber = $("#projectNumber").val();
  $.get("http://isenseproject.org/api/v1/projects/" + waterScience.context.projectNumber, 
     function(data, status){
       waterScience.context.fields = [];
       for (i=0; i< data.fields.length; i++ ) {
          waterScience.context.fields.push([data.fields[i]["name"], data.fields[i]["id"].toString()]);
        }
        var fieldList = "";
        for (i=0; i<waterScience.context.fields.length; i++) 
           fieldList += ",F" + waterScience.context.fields[i][1] + " TEXT";
        if (fieldList != waterScience.context.fieldList) {
          waterScience.database.transaction(function(tx) {
            tx.executeSql("DROP TABLE IF EXISTS data");
//            alert ("CREATE TABLE IF NOT EXISTS data(ID INTEGER PRIMARY KEY ASC, added_on DATETIME, DATAID TEXT, IMAGEURI TEXT"+fieldList+")");
            tx.executeSql("CREATE TABLE IF NOT EXISTS data(ID INTEGER PRIMARY KEY ASC, added_on DATETIME, DATAID TEXT, IMAGEURI TEXT"+fieldList+")");
          });
          waterScience.context.fieldList = fieldList;
        }
        waterScience.setContext('fields', JSON.stringify(waterScience.context.fields));
        waterScience.context.contribution_key = $("#contributionKey").val();
        waterScience.context.contributor_name = $("#contributionName").val();
        waterScience.context.projectNumber = $("#projectNumber").val();
        waterScience.uploadURL = "http://isenseproject.org/api/v1/projects/"+waterScience.context.projectNumber+"/jsonDataUpload"
        waterScience.setContext('context', JSON.stringify(waterScience.context));
        waterScience.updateHTML();
        $.mobile.changePage($('#home'), {
              transition: 'flip',
              reverse: true}); 
  });
},

setContext: function (name,keyValue){
waterScience.errorLoc = "setContext";
try {
  waterScience.database.transaction(function(tx){
    tx.executeSql("INSERT OR REPLACE INTO KEYVALUES (KEYNAME,KEYVALUE) VALUES ('"+name+"','"+keyValue+"')", [], null, 
                 waterScience.onError);
 });
} catch(err) {alert(err.message);}

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
 } catch(err) {alert(err.message);}
},
  
onError : function (error) {
        alert("Error="+waterScience.errorLoc + "--" + error.message);
    },
};



