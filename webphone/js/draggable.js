$(document).ready(function () {
    $(".draggable").draggable({
        handle: ".handle",
        iframeFix: true,
        containment: 'window',
        start: function (event, ui) {
            $('.frameOverlay').show();
            $(".draggable").css({
                right: '',
                bottom: ''
            });
        },
        stop: function (event, ui) {
            $(".frameOverlay").hide();
        }
    });
});