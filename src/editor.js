(function ($) {
  // Capture Squiz_Matrix_API at script-evaluation time (HTML ~line 2031).
  // ntg-central-update-user-profile.js (HTML ~line 2216) overwrites
  // window.Squiz_Matrix_API with a trimmed version that has no setAttribute.
  // Creating js_api here preserves the full update-metadata.js prototype.
  var apiOptions = new Array();
  apiOptions["key"] = "9772315187";
  var js_api = new Squiz_Matrix_API(apiOptions);

  $(document).ready(function () {
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
        .join("\n");

      return labels || "\u00a0";
    }

    // Metadata selects: show display div at rest, reveal <select> on click
    $("select.metadata_options").each(function () {
      var $select = $(this);
      var $existing = $select.prev(".metadata_option_display");
      if ($existing.length) {
        // Already in DOM (page saved with injected divs) — just refresh text
        $existing
          .attr("data-label", $select.attr("data-label") || "")
          .css({ minHeight: "1em" })
          .text(getOptionDisplayText($select));
      } else {
        var $display = $('<div class="metadata_option_display"></div>')
          .attr("data-label", $select.attr("data-label") || "")
          .css({ minHeight: "1em" })
          .text(getOptionDisplayText($select));
        $select.before($display);
      }
      $select.hide();
    });

    $(document).on("click", ".metadata_option_display", function () {
      var $display = $(this);
      var $select = $display.nextAll("select.metadata_options").first();
      var isMultiple = $select.prop("multiple");
      var fieldid = $select.attr("data-metadatafieldid");
      // Store original value so Cancel can restore it
      var currentVal = $select.val();
      $select.data(
        "original-val",
        Array.isArray(currentVal) ? currentVal.slice() : currentVal,
      );
      $display.hide();

      if (!isMultiple) {
        // Single-select (Agency): build a native <select> dropdown popup
        var $ddSelect = $(
          '<select class="form-control single-dropdown-select"></select>',
        );
        $select.find("option").each(function () {
          var $opt = $("<option></option>")
            .val($(this).val())
            .text($(this).text());
          if ($(this).is(":selected")) $opt.prop("selected", true);
          $ddSelect.append($opt);
        });
        var $saveBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
        );
        var $cancelBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
        );
        var $actions = $('<div class="single-dropdown-actions"></div>').append(
          $saveBtn,
          $cancelBtn,
        );
        $display.after(
          $('<div class="single-dropdown"></div>').append($ddSelect, $actions),
        );
        return;
      }

      // Multiselect: build checkbox list
      // For field 446182 (Advertise), restrict options to WoG + current Agency
      var allowedVals = null;
      if (fieldid === "446182") {
        var $row = $select.closest("tr");
        var agencyVal = $row
          .find('select.metadata_options[data-metadatafieldid="445640"]')
          .val();
        allowedVals = agencyVal ? ["WoG", agencyVal] : ["WoG"];
      }

      var $list = $('<div class="multiselect-list"></div>');
      $select.find("option").each(function () {
        if (allowedVals !== null && allowedVals.indexOf($(this).val()) === -1)
          return;
        var $cb = $("<input type='checkbox'/>")
          .val($(this).val())
          .prop("checked", $(this).is(":selected"));
        var $label = $("<label></label>").append(
          $cb,
          document.createTextNode("\u00a0" + $(this).text()),
        );
        $list.append($label);
      });
      var $saveBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
      );
      var $cancelBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
      );
      var $actions = $('<div class="metadata_option_actions"></div>').append(
        $saveBtn,
        $cancelBtn,
      );
      $display.after(
        $('<div class="multiselect-dropdown"></div>').append($list, $actions),
      );
    });

    $(document).on(
      "click",
      ".metadata_option_actions [data-action='save']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".multiselect-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var checkedVals = $dropdown
          .find("input[type=checkbox]:checked")
          .map(function () {
            return $(this).val();
          })
          .get();
        $select.val(checkedVals);
        var value = $select.val() ? $select.val().join(";") : "";
        var assetid = $select.closest("tr").attr("id");
        var fieldid = $select.attr("data-metadatafieldid");
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        submit(value, assetid, fieldid);
      },
    );

    $(document).on(
      "click",
      ".metadata_option_actions [data-action='cancel']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".multiselect-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) {
          $select.val(originalVal);
        }
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
      },
    );

    $(document).on(
      "click",
      ".single-dropdown-actions [data-action='save']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".single-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var newVal = $dropdown.find(".single-dropdown-select").val();
        var assetid = $select.closest("tr").attr("id");
        var fieldid = $select.attr("data-metadatafieldid");
        $select.val(newVal);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        submit(newVal, assetid, fieldid);
        // Sync advertise (field 446182): update to WoG + new Agency (or WoG only)
        var $row = $select.closest("tr");
        var $advertiseSelect = $row.find(
          'select.metadata_options[data-metadatafieldid="446182"]',
        );
        if ($advertiseSelect.length) {
          var advertiseVals = newVal ? ["WoG", newVal] : ["WoG"];
          var advertiseStr = advertiseVals.join(";");
          $advertiseSelect.val(advertiseVals);
          var $advertiseDisplay = $advertiseSelect.prev(
            ".metadata_option_display",
          );
          $advertiseDisplay.text(getOptionDisplayText($advertiseSelect));
          submit(advertiseStr, assetid, "446182");
        }
      },
    );

    $(document).on(
      "click",
      ".single-dropdown-actions [data-action='cancel']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".single-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) {
          $select.val(originalVal);
        }
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
      },
    );

    $(document).on("click", function (e) {
      if (
        $(e.target).closest(
          ".metadata_option_display, .multiselect-dropdown, .single-dropdown",
        ).length
      )
        return;
      $(".multiselect-dropdown, .single-dropdown").each(function () {
        var $dropdown = $(this);
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        // Treat outside click as Cancel — restore original value
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) {
          $select.val(originalVal);
        }
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
      });
    });

    // Inline click-to-edit: replaces Jeditable dependency.
    // onSave(value, $el) is called when the user clicks Save.
    function makeEditable($elems, onSave) {
      $elems.css({ cursor: "pointer", minHeight: "1em" });
      $elems.on("click.inlineEdit", function () {
        var $el = $(this);
        if ($el.find("textarea").length) return; // already editing
        var savedText = $el.text().trim();

        var $textarea = $('<textarea class="form-control" rows="2">').val(
          savedText,
        );
        var $saveBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
        );
        var $cancelBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
        );
        var $actions = $(
          '<div style="margin-top:4px;display:flex;gap:4px;">',
        ).append($saveBtn, $cancelBtn);

        $el.empty().append($textarea, $actions);
        $textarea.focus();

        $cancelBtn.on("click", function (e) {
          e.stopPropagation();
          $el.empty().text(savedText);
        });

        $saveBtn.on("click", function (e) {
          e.stopPropagation();
          onSave($textarea.val(), $el);
        });

        $textarea.on("keydown.inlineEdit", function (e) {
          if (e.keyCode === 27) {
            $el.empty().text(savedText);
          }
        });
      });
    }

    makeEditable(
      $(".metadata-editor .edit_area:not([data-datepicker='true'])"),
      function (value, $el) {
        var assetid = $el.closest("tr").attr("id");
        var fieldid = $el.attr("data-metadatafieldid");
        submit(value, assetid, fieldid);
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

        var $saveBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
        );
        var $cancelBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
        );
        var $actions = $(
          '<div style="margin-top:4px;display:flex;gap:4px;">',
        ).append($saveBtn, $cancelBtn);

        // Clear the div and add the input + buttons
        $field.empty().append($input, $actions);

        // Track what the datepicker has selected (may differ from typed value)
        var selectedIsoDate = null;
        var selectedDisplayDate = null;

        // Initialize datepicker on the input
        $input.datepicker({
          format: "dd/mm/yyyy",
          autoclose: true,
          todayBtn: "linked",
          todayHighlight: true,
          orientation: "bottom auto",
          container: "body",
        });

        $input.datepicker("show");
        $input.focus();

        // When a date is chosen in the picker, record it but don't submit yet
        $input.on("changeDate", function (e) {
          if (e.date) {
            selectedDisplayDate = $input.datepicker("getFormattedDate");
            selectedIsoDate = australianToIso(selectedDisplayDate);
          }
        });

        $cancelBtn.on("click", function (e) {
          e.stopPropagation();
          $input.datepicker("destroy");
          $field.empty().text(currentText);
        });

        $saveBtn.on("click", function (e) {
          e.stopPropagation();
          // Use picker-selected date if available, otherwise parse typed value
          var displayDate = selectedDisplayDate || $input.val().trim();
          var isoDate = selectedIsoDate || australianToIso(displayDate);
          var assetid = $field.closest("tr").attr("id");
          var fieldid = $field.attr("data-metadatafieldid");
          $input.datepicker("destroy");
          $field.empty().text(displayDate);
          submit(isoDate, assetid, fieldid);
        });
      });
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
      if (!data.changes || !data.changes[0]) return;
      var updatedData = data.changes[0];

      var $cell = $('tr[id="' + updatedData.assetid + '"]').find(
        '.edit_area[data-metadatafieldid="' + updatedData.fieldid + '"]',
      );

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

    makeEditable($(".attribute-editor .edit_area"), function (value, $el) {
      transaction = {
        attrValue: value,
        assetid: $el.closest("tr").attr("id"),
        attrName: $el.attr("data-attributename"),
      };
      $el.attr("data-newvalue", value).addClass("pending");
      submitAttr(transaction);
    });

    function submitAttr(transaction) {
      js_api.setAttribute({
        asset_id: transaction.assetid,
        attr_name: transaction.attrName,
        attr_val: transaction.attrValue,
        dataCallback: resultAttr,
        errorCallback: function () {
          displayResultAttr("Save failed \u2014 please try again.", "error");
          $('tr[id="' + transaction.assetid + '"]')
            .find(
              '.edit_area[data-attributename="' + transaction.attrName + '"]',
            )
            .removeClass("pending");
        },
      });
    }

    function resultAttr(data) {
      if (Array.isArray(data) && data[0].indexOf("successfully set") !== -1) {
        displayResultAttr(data[0], "success");
        refreshTableCellsAttr("success");
      } else {
        var msg = Array.isArray(data)
          ? data[0]
          : data.error || "An error occurred.";

        // File assets (Word, PDF, etc.) store their title as the "title"
        // attribute, not "short_name". If the page was rendered with the old
        // template, silently retry with "title" and patch the DOM so future
        // edits on this row go straight to the correct attribute.
        if (
          transaction.attrName === "short_name" &&
          msg.indexOf("does not exist") !== -1
        ) {
          $('tr[id="' + transaction.assetid + '"]')
            .find('.edit_area[data-attributename="short_name"]')
            .attr("data-attributename", "title");
          transaction.attrName = "title";
          submitAttr(transaction);
          return;
        }

        displayResultAttr(msg, "error");
        $('tr[id="' + transaction.assetid + '"]')
          .find('.edit_area[data-attributename="' + transaction.attrName + '"]')
          .removeClass("pending");
      }
    }

    function refreshTableCellsAttr(cls) {
      $('tr[id="' + transaction.assetid + '"]')
        .find('.edit_area[data-attributename="' + transaction.attrName + '"]')
        .removeClass("pending")
        .addClass(cls)
        .text(transaction.attrValue);
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
})(jQuery);
