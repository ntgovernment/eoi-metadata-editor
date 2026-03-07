$(document).ready(function () {
  $(".sidemenu li span.link a").each(function () {
    var string = $(this).text();
    string = string.replace("(( ", "");
    string = string.replace(" ))", "");
    $(this).text(string);
  });

  $("a.toggleDiffs").on("click", function () {
    if (window.location.href.indexOf("SQ_ACTION=diff") > 0) {
      location.assign(window.location.href.replace("SQ_ACTION=diff", ""));
    } else {
      if (window.location.href.indexOf("?") > 0) {
        var cleanHREF = window.location.href.replace("&&", "&");
        location.assign(cleanHREF + "&SQ_ACTION=diff");
      } else {
        location.assign(window.location.href + "?SQ_ACTION=diff");
      }
    }
  });

  //Comments

  var commentData = [];
  var containerComments = new Object();

  if (commentData.length > 0) {
    $.each(commentData, function (index, groupItem) {
      if (groupItem.containerid !== "") {
        containerComments[groupItem.containerid] = groupItem["comments"];
      }
    });
  }

  $.each(containerComments, function (containerID, containerData) {
    $("[id*=" + containerID + "]").addClass(
      "relpos hasComments pr-5 mr-2 rb-1 clearfix",
    );

    var outputString = '<div class="comments-wrapper">';

    $.each(containerData, function (b, item) {
      outputString += '<div class="editor-comments ' + item.status + '">';

      outputString += '<span class="status">' + item.status + "</span>";

      //Individual comments
      $.each(item.comments, function (c, comment) {
        var commentDate = new Date(comment.timestamp);
        outputString +=
          '<div title="' +
          commentDate +
          '" class="editor-comments-item"><small>' +
          comment.userFirstName +
          " " +
          comment.userLastName +
          "</small></br>";
        outputString += comment.content;
        outputString += "</div>";
      });

      outputString += "</div>";
    });

    outputString += "</div>";

    console.log(outputString);

    //Write the comments to the relevant container
    $("[id*=" + containerID + "]").prepend(outputString);
  });
});
