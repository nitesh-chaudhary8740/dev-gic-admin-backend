document.addEventListener('DOMContentLoaded', function () {
  // confirm before destructive actions: <form data-confirm="...">
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
  });

  // rich text editor
  var editorEl = document.getElementById('editor');
  if (editorEl && window.Quill) {
    var quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'link'],
          ['clean']
        ]
      }
    });
    var form = editorEl.closest('form');
    form.addEventListener('submit', function () {
      document.getElementById('content').value = quill.getText().trim() ? quill.root.innerHTML : '';
    });
  }
});