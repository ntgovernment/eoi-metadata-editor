$(document).ready(function () {
  //JS API
  var options = new Array();
  options["key"] = "9772315187";
  var js_api = new Squiz_Matrix_API(options);

  //Default selections
  $(".metadata_options").each(function () {
    var presetValue = $(this).attr("data-current");
    if ($(this).prop("multiple")) {
      try {
        $(this).val(JSON.parse(presetValue));
      } catch (e) {
        $(this).val(presetValue);
      }
    } else {
      $(this).val(presetValue);
    }
  });

  $(".metadata-editor .edit_area").editable(
    function (value, settings) {
      return value;
    },
    {
      type: "textarea",
    },
  );

  $(document).on("blur", ".edit_area textarea", function () {
    var value = $(this).val();
    var assetid = $(this).closest("tr").attr("id");
    var fieldid = $(this).closest(".edit_area").attr("data-metadatafieldid");

    submit(value, assetid, fieldid);
    return value;
  });

  $(document).on("change", ".metadata_options", function () {
    console.log("I changed");

    var value = $(this).prop("multiple")
      ? $(this).val().join(";")
      : $(this).find(":selected").val();
    var assetid = $(this).closest("tr").attr("id");
    var fieldid = $(this).attr("data-metadatafieldid");

    submit(value, assetid, fieldid);

    return value;
  });

  function submit(content, assetID, fieldid) {
    js_api.setMetadata({
      asset_id: assetID,
      field_id: fieldid,
      field_val: content,
      dataCallback: result,
    });
  }

  function result(data) {
    if ("success" in data) {
      displayResult(data.success[0], "success");
      refreshTableCell(data);
    } else if ("error" in data) {
      displayResult(data.error, "error");
    }
  }

  function refreshTableCell(data) {
    var updatedData = data.changes[0];

    $(".metadata-editor table")
      .find("tr[id=" + updatedData.assetid + "]")
      .find(".edit_area[data-metadatafieldid=" + updatedData.fieldid + "]")
      .text(updatedData.value);

    return;
  }

  function displayResult(msg, status) {
    $(".results")
      .removeClass("alert-success alert-error")
      .addClass("alert-" + status);
    $(".results").text(msg).show();
    setTimeout(function () {
      $(".results").fadeOut();
    }, 3000);
  }

  var transaction = {};

  $(".attribute-editor .edit_area").editable(
    function (value, settings) {
      return value;
    },
    {
      type: "textarea",
    },
  );

  $(".attribute-editor .edit_area").on("blur", "textarea", function () {
    transaction = {
      attrValue: $(this).val(),
      assetid: $(this).closest("tr").attr("id"),
      attrName: $(this)
        .closest(".attribute-editor .edit_area")
        .attr("data-attributename"),
    };

    $(this)
      .closest(".edit_area")
      .attr("data-newvalue", transaction.attrValue)
      .addClass("pending");
    submitAttr(transaction);
  });

  function submitAttr(transaction) {
    js_api.setAttribute({
      asset_id: transaction.assetid,
      attr_name: transaction.attrName,
      attr_val: transaction.attrValue,
      dataCallback: resultAttr,
    });
  }

  function resultAttr(data) {
    var resultString = data[0];

    if (resultString.indexOf("successfully set") !== -1) {
      displayResultAttr(resultString, "success");
      refreshTableCellsAttr("success");
    } else if (data[0].indexOf("error") !== -1) {
      displayResultAttr(data[0], "error");
      refreshTableCellsAttr("error");
    }

    return;
  }

  function refreshTableCellsAttr(cls) {
    console.log(transaction);

    $(".attribute-editor table")
      .find('tr[id="' + transaction.assetid + '"]')
      .find('.edit_area[data-attributename="' + transaction.attrName + '"]')
      .removeClass("pending")
      .addClass(cls)
      .text(transaction.attrValue);

    //return;
  }

  function displayResultAttr(msg, status) {
    $(".results")
      .removeClass("alert-success alert-error")
      .addClass("alert-" + status);
    $(".results").text(msg).show();
    setTimeout(function () {
      $(".results").fadeOut();
    }, 3000);
  }

  // Setup - add a text input to each footer cell
  // $('#myTable thead tr').clone(true).appendTo( '#myTable thead' );
  // $('#myTable thead tr:eq(1) th').each( function (i) {
  //     var title = $(this).text();
  //     $(this).html( '<input type="text" placeholder="Search '+title+'" />' );

  //     $( 'input', this ).on( 'keyup change', function () {
  //         if ( table.column(i).search() !== this.value ) {
  //             table
  //                 .column(i)
  //                 .search( this.value )
  //                 .draw();
  //         }
  //     } );
  // } );

  // var table = $('#myTable').DataTable( {
  //     "ordering": false,
  //     orderCellsTop: true,
  //     fixedHeader: true,
  //     "lengthChange": false,
  //     "paging": true
  // } );
});
