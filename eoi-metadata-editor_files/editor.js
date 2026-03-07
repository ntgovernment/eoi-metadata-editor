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

  function getOptionDisplayText($select) {
    var labels = $select
      .find("option:selected")
      .map(function () {
        return $(this).text();
      })
      .get()
      .join(", ");

    return labels || "\u00a0";
  }

  // Metadata selects: show display div at rest, reveal <select> on click
  $("select.metadata_options").each(function () {
    var $select = $(this);
    var $display = $('<div class="metadata_option_display"></div>')
      .css({ cursor: "pointer", minHeight: "1em" })
      .text(getOptionDisplayText($select));
    $select.before($display);
    $select.hide();
  });

  $(document).on("click", ".metadata_option_display", function () {
    var $display = $(this);
    var $select = $display.next("select.metadata_options");
    $display.hide();
    $select.show();
  });

  $(document).on("click", function (e) {
    if ($(e.target).is(".metadata_option_display")) return;
    if (!$(e.target).closest("select.metadata_options").length) {
      $("select.metadata_options:visible").each(function () {
        var $select = $(this);
        $select
          .prev(".metadata_option_display")
          .text(getOptionDisplayText($select))
          .show();
        $select.hide();
      });
    }
  });

  // Metadata editors: exclude datepicker fields from Jeditable
  $(".metadata-editor .edit_area:not([data-datepicker='true'])").editable(
    function (value, settings) {
      return value;
    },
    {
      type: "textarea",
    },
  );

  // Helper functions for date conversion
  function isoToAustralian(isoDate) {
    if (!isoDate || isoDate === "") return "";
    // Handle both YYYY-MM-DD and YYYY-MM-DD HH:MM:SS formats
    var datePart = isoDate.split(" ")[0];
    var parts = datePart.split("-");
    if (parts.length === 3) {
      return parts[2] + "/" + parts[1] + "/" + parts[0]; // DD/MM/YYYY
    }
    return isoDate; // Return original if not in expected format
  }

  function australianToIso(ausDate) {
    if (!ausDate || ausDate === "") return "";
    var parts = ausDate.split("/");
    if (parts.length === 3) {
      return parts[2] + "-" + parts[1] + "-" + parts[0]; // YYYY-MM-DD
    }
    return ausDate; // Return original if not in expected format
  }

  // Initialize Bootstrap Datepicker for closing date fields
  $(".edit_area[data-datepicker='true']").each(function () {
    var $field = $(this);
    var currentValue = $field.text().trim();

    // Convert ISO date to Australian format for display
    var displayValue = isoToAustralian(currentValue);
    $field.text(displayValue);

    // Store original styling
    $field.css({
      cursor: "pointer",
      minHeight: "1em",
    });

    // Click handler to show datepicker input
    $field.on("click", function () {
      if ($field.find("input").length > 0) return; // Already editing

      var currentText = $field.text().trim();

      // Create input element
      var $input = $('<input type="text" class="form-control">');
      $input.val(currentText);

      // Clear the div and add the input
      $field.empty().append($input);

      // Initialize datepicker on the input
      $input.datepicker({
        format: "dd/mm/yyyy",
        autoclose: true,
        todayHighlight: true,
        orientation: "bottom auto",
        container: "body",
      });

      // Show the datepicker immediately
      $input.datepicker("show");
      $input.focus();

      // Handle date selection
      $input.on("changeDate", function (e) {
        if (e.date) {
          var assetid = $field.closest("tr").attr("id");
          var fieldid = $field.attr("data-metadatafieldid");

          // Get the date in DD/MM/YYYY format
          var selectedDateStr = $input.datepicker("getFormattedDate");

          // Convert to ISO format for server
          var isoDate = australianToIso(selectedDateStr);

          // Update display
          $input.datepicker("hide");
          $input.remove();
          $field.text(selectedDateStr);

          // Submit to server
          submit(isoDate, assetid, fieldid);
        }
      });

      // Handle blur - cancel editing
      $input.on("blur", function () {
        setTimeout(function () {
          if ($input.parent().length) {
            $input.datepicker("destroy");
            $input.remove();
            $field.text(currentText);
          }
        }, 200);
      });
    });
  });

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

    var $cell = $(".metadata-editor table")
      .find("tr[id=" + updatedData.assetid + "]")
      .find(".edit_area[data-metadatafieldid=" + updatedData.fieldid + "]");

    // Check if this is a datepicker field
    if ($cell.attr("data-datepicker") === "true") {
      // Convert ISO date to Australian format
      var displayValue = isoToAustralian(updatedData.value);
      $cell.text(displayValue);
    } else {
      $cell.text(updatedData.value);
    }

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
